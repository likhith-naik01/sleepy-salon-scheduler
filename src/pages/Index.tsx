import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Users, Scissors, Info, Save, Play, Download, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Customer and Barber States
enum CustomerState {
  WAITING = 'waiting',
  GETTING_HAIRCUT = 'getting_haircut',
  SERVED = 'served',
  TURNED_AWAY = 'turned_away'
}

enum BarberState {
  SLEEPING = 'sleeping',
  WORKING = 'working'
}

// Customer and Barber interfaces
interface Customer {
  id: number;
  name: string;
  state: CustomerState;
  timeArrived: number;
  timeServed?: number;
  timeLeft?: number;
  servedBy?: number;
  waitingPosition?: number;
}

interface Barber {
  id: number;
  state: BarberState;
  servingCustomerId: number | null;
  totalCustomersServed: number;
  currentServiceStartTime?: number;
}

// Simulation state interface for saving/loading
interface SimulationState {
  numBarbers: number;
  numChairs: number;
  serviceTime: number;
  arrivalRate: number;
  simulationSpeed: number;
  currentTime: number;
  nextCustomerId: number;
  barbers: Barber[];
  waitingCustomers: Customer[];
  currentCustomers: Customer[];
  servedCustomers: Customer[];
  turnedAwayCustomers: Customer[];
}

// Main component
const Index = () => {
  // Simulation parameters
  const [numBarbers, setNumBarbers] = useState(1);
  const [numChairs, setNumChairs] = useState(3);
  const [serviceTime, setServiceTime] = useState(10); // seconds
  const [arrivalRate, setArrivalRate] = useState(3); // customers per minute
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  
  // Simulation state
  const [currentTime, setCurrentTime] = useState(0);
  const [nextCustomerId, setNextCustomerId] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [waitingCustomers, setWaitingCustomers] = useState<Customer[]>([]);
  const [currentCustomers, setCurrentCustomers] = useState<Customer[]>([]);
  const [servedCustomers, setServedCustomers] = useState<Customer[]>([]);
  const [turnedAwayCustomers, setTurnedAwayCustomers] = useState<Customer[]>([]);
  
  // Customer input fields
  const [customerName, setCustomerName] = useState('');
  const [customersToAdd, setCustomersToAdd] = useState(1);
  
  // Animation frame reference
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // File input ref for loading saved state
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Metrics
  const averageWaitTime = React.useMemo(() => {
    if (servedCustomers.length === 0) return 0;
    const totalWaitTime = servedCustomers.reduce((total, customer) => {
      const waitTime = (customer.timeServed || 0) - customer.timeArrived;
      return total + waitTime;
    }, 0);
    return totalWaitTime / servedCustomers.length;
  }, [servedCustomers]);
  
  // Initialize simulation
  useEffect(() => {
    initializeSimulation();
  }, []);
  
  const initializeSimulation = () => {
    const initialBarbers = Array.from({ length: numBarbers }).map((_, index) => ({
      id: index + 1,
      state: BarberState.SLEEPING,
      servingCustomerId: null,
      totalCustomersServed: 0
    }));
    
    setBarbers(initialBarbers);
    setWaitingCustomers([]);
    setCurrentCustomers([]);
    setServedCustomers([]);
    setTurnedAwayCustomers([]);
    setCurrentTime(0);
    setNextCustomerId(1);
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    initializeSimulation();
  };
  
  // Start simulation
  const startSimulation = () => {
    if (barbers.length === 0) {
      initializeSimulation();
    }
    setIsRunning(true);
    lastTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animationLoop);
  };
  
  // Pause simulation
  const pauseSimulation = () => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
  
  // Animation loop
  const animationLoop = (timestamp: number) => {
    if (!isRunning) return;
    
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Scale time based on simulation speed (convert ms to seconds)
    const timeStep = (deltaTime / 1000) * simulationSpeed;
    
    processTimeStep(timeStep);
    animationRef.current = requestAnimationFrame(animationLoop);
  };
  
  // Add a customer manually via the booking form
  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a customer name",
        variant: "destructive"
      });
      return;
    }
    addCustomerWithName(customerName);
    setCustomerName('');
  };
  
  // Add a customer to the salon with a name
  const addCustomerWithName = (name: string) => {
    const nextId = nextCustomerId;
    
    // Check if there are any sleeping barbers
    const sleepingBarberId = barbers.findIndex(b => b.state === BarberState.SLEEPING);
    
    if (sleepingBarberId !== -1) {
      // Wake up the barber and assign the customer
      const updatedBarbers = [...barbers];
      updatedBarbers[sleepingBarberId] = {
        ...updatedBarbers[sleepingBarberId],
        state: BarberState.WORKING,
        servingCustomerId: nextId,
        currentServiceStartTime: currentTime,
        totalCustomersServed: updatedBarbers[sleepingBarberId].totalCustomersServed + 1
      };

      const newCustomer: Customer = {
        id: nextId,
        name: name,
        state: CustomerState.GETTING_HAIRCUT,
        timeArrived: currentTime,
        timeServed: currentTime,
        servedBy: sleepingBarberId + 1
      };

      setBarbers(updatedBarbers);
      setCurrentCustomers(prev => [...prev, newCustomer]);
      setNextCustomerId(nextId + 1);
      
      toast({
        title: "Customer Seated",
        description: `${name} is now getting a haircut from Barber #${sleepingBarberId + 1}`
      });
    } 
    // If all barbers are busy, try to add to waiting queue
    else if (waitingCustomers.length < numChairs) {
      const newCustomer: Customer = {
        id: nextId,
        name: name,
        state: CustomerState.WAITING,
        timeArrived: currentTime,
        waitingPosition: waitingCustomers.length
      };

      setWaitingCustomers(prev => [...prev, newCustomer]);
      setNextCustomerId(nextId + 1);
      
      toast({
        title: "Added to Waiting List",
        description: `${name} is now waiting (position #${waitingCustomers.length + 1})`
      });
    } 
    // If waiting area is full, turn away the customer
    else {
      const newCustomer: Customer = {
        id: nextId,
        name: name,
        state: CustomerState.TURNED_AWAY,
        timeArrived: currentTime,
        timeLeft: currentTime
      };

      setTurnedAwayCustomers(prev => [...prev, newCustomer]);
      setNextCustomerId(nextId + 1);
      
      toast({
        title: "Customer Turned Away",
        description: `${name} was turned away because the waiting area is full`,
        variant: "destructive"
      });
    }
  };
  
  // Add a random customer to the salon
  const addRandomCustomer = () => {
    const randomNames = ["Alex", "Sam", "Jamie", "Taylor", "Jordan", "Casey", "Avery", "Riley", "Quinn", "Morgan"];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + " " + nextCustomerId;
    addCustomerWithName(randomName);
  };
  
  // Add multiple customers at once
  const addMultipleCustomers = () => {
    const count = customersToAdd > 0 ? customersToAdd : 1;
    for (let i = 0; i < count; i++) {
      addRandomCustomer();
    }
    toast({
      title: "Customers Added",
      description: `Added ${count} new customers to the salon`
    });
  };
  
  // Process a time step
  const processTimeStep = (timeStep: number) => {
    if (!isRunning) return;
    
    const newTime = currentTime + timeStep;
    
    // Check for finishing haircuts
    const updatedBarbers = [...barbers];
    const finishedCustomers: Customer[] = [];
    const stillServingCustomers: Customer[] = [];
    
    // Process each customer currently being served
    currentCustomers.forEach(customer => {
      if (customer.state === CustomerState.GETTING_HAIRCUT && customer.timeServed) {
        const barberId = customer.servedBy! - 1;
        
        // If haircut is finished
        if (newTime - customer.timeServed >= serviceTime) {
          const finishedCustomer = {
            ...customer,
            state: CustomerState.SERVED,
            timeLeft: newTime
          };
          finishedCustomers.push(finishedCustomer);
          
          // Free up the barber
          if (waitingCustomers.length > 0) {
            // Get the next waiting customer
            const nextCustomer = waitingCustomers[0];
            const updatedNextCustomer = {
              ...nextCustomer,
              state: CustomerState.GETTING_HAIRCUT,
              timeServed: newTime,
              servedBy: barberId + 1,
              waitingPosition: undefined
            };
            
            // Update barber state
            updatedBarbers[barberId] = {
              ...updatedBarbers[barberId],
              servingCustomerId: nextCustomer.id,
              currentServiceStartTime: newTime
            };
            
            // Add customer to currently being served
            stillServingCustomers.push(updatedNextCustomer);
            
            toast({
              title: "Haircut Complete",
              description: `${customer.name} finished their haircut. ${nextCustomer.name} is now being served by Barber #${barberId + 1}.`
            });
          } else {
            // No customers waiting, barber goes to sleep
            updatedBarbers[barberId] = {
              ...updatedBarbers[barberId],
              state: BarberState.SLEEPING,
              servingCustomerId: null,
              currentServiceStartTime: undefined
            };
            
            toast({
              title: "Haircut Complete",
              description: `${customer.name} finished their haircut. Barber #${barberId + 1} is now sleeping.`
            });
          }
        } else {
          // Customer still getting haircut
          stillServingCustomers.push(customer);
        }
      }
    });
    
    // Update waiting queue by removing the first customer if they were called
    let updatedWaitingCustomers = [...waitingCustomers];
    if (waitingCustomers.length > 0 && 
        finishedCustomers.length > 0) {
      updatedWaitingCustomers = waitingCustomers.slice(1).map((c, idx) => ({
        ...c,
        waitingPosition: idx
      }));
    }
    
    // Random customer arrival based on arrival rate
    const arrivalProbability = (arrivalRate / 60) * timeStep;
    const shouldAddCustomer = Math.random() < arrivalProbability;
    
    setCurrentTime(newTime);
    setBarbers(updatedBarbers);
    setCurrentCustomers(stillServingCustomers);
    setWaitingCustomers(updatedWaitingCustomers);
    setServedCustomers(prev => [...prev, ...finishedCustomers]);
    
    // Add random customer after state update if probability hits and simulation is running
    if (shouldAddCustomer && isRunning) {
      addRandomCustomer();
    }
  };
  
  // Save simulation state
  const saveSimulation = () => {
    const simulationState: SimulationState = {
      numBarbers,
      numChairs,
      serviceTime,
      arrivalRate,
      simulationSpeed,
      currentTime,
      nextCustomerId,
      barbers,
      waitingCustomers,
      currentCustomers,
      servedCustomers,
      turnedAwayCustomers
    };
    
    const stateBlob = new Blob([JSON.stringify(simulationState)], { type: 'application/json' });
    const url = URL.createObjectURL(stateBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `barber-simulation-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Simulation Saved",
      description: "Your current simulation state has been downloaded"
    });
  };
  
  // Load simulation state
  const loadSimulation = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const simulationState: SimulationState = JSON.parse(content);
        
        // Restore all state
        setNumBarbers(simulationState.numBarbers);
        setNumChairs(simulationState.numChairs);
        setServiceTime(simulationState.serviceTime);
        setArrivalRate(simulationState.arrivalRate);
        setSimulationSpeed(simulationState.simulationSpeed);
        setCurrentTime(simulationState.currentTime);
        setNextCustomerId(simulationState.nextCustomerId);
        setBarbers(simulationState.barbers);
        setWaitingCustomers(simulationState.waitingCustomers);
        setCurrentCustomers(simulationState.currentCustomers);
        setServedCustomers(simulationState.servedCustomers);
        setTurnedAwayCustomers(simulationState.turnedAwayCustomers);
        
        toast({
          title: "Simulation Loaded",
          description: "Your saved simulation state has been restored"
        });
      } catch (error) {
        toast({
          title: "Error Loading File",
          description: "The selected file is not a valid simulation state",
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input to allow loading the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Update simulation parameters
  const updateBarberCount = (newCount: number) => {
    if (newCount < 1) newCount = 1;
    if (newCount > 5) newCount = 5;
    
    if (newCount > numBarbers) {
      // Add new barbers
      const currentBarberCount = barbers.length;
      const newBarbers = Array.from({ length: newCount - currentBarberCount }).map((_, index) => ({
        id: currentBarberCount + index + 1,
        state: BarberState.SLEEPING,
        servingCustomerId: null,
        totalCustomersServed: 0
      }));
      
      setBarbers(prev => [...prev, ...newBarbers]);
    } else if (newCount < numBarbers) {
      // Remove barbers from the end (only if they're sleeping)
      const updatedBarbers = [...barbers];
      let removedCount = 0;
      
      for (let i = barbers.length - 1; i >= 0 && removedCount < (numBarbers - newCount); i--) {
        if (updatedBarbers[i].state === BarberState.SLEEPING) {
          updatedBarbers.splice(i, 1);
          removedCount++;
        }
      }
      
      // Update IDs to be sequential
      updatedBarbers.forEach((barber, index) => {
        barber.id = index + 1;
      });
      
      setBarbers(updatedBarbers);
    }
    
    setNumBarbers(newCount);
  };
  
  const updateChairCount = (newCount: number) => {
    if (newCount < 1) newCount = 1;
    if (newCount > 10) newCount = 10;
    
    // If reducing chairs and there are customers in those chairs
    if (newCount < numChairs && waitingCustomers.length > newCount) {
      const customersToTurnAway = waitingCustomers.slice(newCount);
      const customersStaying = waitingCustomers.slice(0, newCount);
      
      const updatedTurnedAway = customersToTurnAway.map(customer => ({
        ...customer,
        state: CustomerState.TURNED_AWAY,
        timeLeft: currentTime
      }));
      
      setWaitingCustomers(customersStaying);
      setTurnedAwayCustomers(prev => [...prev, ...updatedTurnedAway]);
      
      toast({
        title: "Chairs Removed",
        description: `${customersToTurnAway.length} waiting customers had to leave due to chair removal`,
        variant: "destructive"
      });
    }
    
    setNumChairs(newCount);
  };
  
  // Formatted time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-salon-secondary mb-2">Sleeping Barber Simulation</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            An educational visualization of the classic operating system synchronization problem
          </p>
        </header>

        <Tabs defaultValue="simulation" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
            <TabsTrigger value="booking">Booking System</TabsTrigger>
            <TabsTrigger value="explanation">Explanation</TabsTrigger>
          </TabsList>
          
          <TabsContent value="simulation" className="space-y-6">
            {/* Controls Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Simulation Controls
                </CardTitle>
                <CardDescription>
                  Configure parameters and control the simulation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="numBarbers">Number of Barbers: {numBarbers}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateBarberCount(numBarbers - 1)}
                          disabled={numBarbers <= 1}
                        >
                          -
                        </Button>
                        <Slider
                          id="numBarbers"
                          min={1}
                          max={5}
                          step={1}
                          value={[numBarbers]}
                          onValueChange={(values) => updateBarberCount(values[0])}
                        />
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => updateBarberCount(numBarbers + 1)}
                          disabled={numBarbers >= 5}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="numChairs">Waiting Chairs: {numChairs}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateChairCount(numChairs - 1)}
                          disabled={numChairs <= 1}
                        >
                          -
                        </Button>
                        <Slider
                          id="numChairs"
                          min={1}
                          max={10}
                          step={1}
                          value={[numChairs]}
                          onValueChange={(values) => updateChairCount(values[0])}
                        />
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => updateChairCount(numChairs + 1)}
                          disabled={numChairs >= 10}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    
                    {/* Save/Load Buttons */}
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        onClick={saveSimulation} 
                        className="flex items-center gap-2"
                      >
                        <Save className="h-4 w-4" />
                        Save State
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()} 
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Load State
                      </Button>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".json" 
                        onChange={loadSimulation} 
                        className="hidden" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="serviceTime">Service Time: {serviceTime}s</Label>
                      <Slider
                        id="serviceTime"
                        min={5}
                        max={30}
                        step={1}
                        value={[serviceTime]}
                        onValueChange={(values) => setServiceTime(values[0])}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="simulationSpeed">Simulation Speed: {simulationSpeed}x</Label>
                      <Slider
                        id="simulationSpeed"
                        min={0.5}
                        max={5}
                        step={0.5}
                        value={[simulationSpeed]}
                        onValueChange={(values) => setSimulationSpeed(values[0])}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="arrivalRate">Customer Arrival Rate: {arrivalRate}/minute</Label>
                      <Slider
                        id="arrivalRate"
                        min={1}
                        max={10}
                        step={1}
                        value={[arrivalRate]}
                        onValueChange={(values) => setArrivalRate(values[0])}
                      />
                    </div>
                    
                    {/* Add Multiple Customers Control */}
                    <div className="space-y-2">
                      <Label htmlFor="customersToAdd">Add Multiple Customers:</Label>
                      <div className="flex gap-2">
                        <Input
                          id="customersToAdd"
                          type="number"
                          min="1"
                          max="20"
                          value={customersToAdd}
                          onChange={(e) => setCustomersToAdd(Number(e.target.value))}
                          className="w-24"
                        />
                        <Button 
                          onClick={addMultipleCustomers} 
                          className="flex items-center gap-2"
                        >
                          <Users className="h-4 w-4" />
                          Add Customers
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  Simulation Time: {formatTime(currentTime)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetSimulation}>
                    Reset
                  </Button>
                  {isRunning ? (
                    <Button onClick={pauseSimulation}>
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={startSimulation} className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      {barbers.length === 0 ? "Start" : "Resume"}
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
            
            {/* Salon Visualization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-5 w-5" />
                  Salon Visualization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Barber Area */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-medium mb-3">Barber Stations</h3>
                    <div className="barber-shop-floor p-4 flex flex-wrap gap-6">
                      {barbers.map((barber) => (
                        <div key={barber.id} className="relative">
                          <div className={`barber ${barber.state === BarberState.SLEEPING ? 'barber-sleeping animate-sleeping' : 'barber-working'}`}>
                            <Scissors className="w-6 h-6" />
                          </div>
                          <div className="mt-2 text-center text-sm font-medium">
                            Barber #{barber.id}
                          </div>
                          <div className="text-xs text-center">
                            {barber.state === BarberState.SLEEPING ? 'Sleeping' : 'Working'}
                          </div>
                          {barber.servingCustomerId && (
                            <div className="absolute -right-4 -top-4">
                              <div className="customer">
                                <User className="w-4 h-4" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {barbers.length === 0 && (
                        <div className="text-center w-full py-8 text-gray-500">
                          Start the simulation to see barbers
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Waiting Area */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Waiting Area ({waitingCustomers.length}/{numChairs})</h3>
                    <div className="waiting-area min-h-[200px]">
                      {waitingCustomers.map((customer, index) => (
                        <div key={customer.id} className="flex items-center gap-2 p-2 mb-2 bg-slate-100 rounded-md">
                          <div className="w-8 h-8 rounded-full bg-salon-secondary flex items-center justify-center text-white">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium truncate">{customer.name}</div>
                            <div className="text-xs text-gray-500">Position: {index + 1}</div>
                          </div>
                        </div>
                      ))}
                      
                      {waitingCustomers.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No customers waiting
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-salon-peach/30 p-4 rounded-lg">
                    <div className="text-lg font-bold">{servedCustomers.length}</div>
                    <div className="text-sm text-gray-600">Customers Served</div>
                  </div>
                  
                  <div className="bg-salon-primary/20 p-4 rounded-lg">
                    <div className="text-lg font-bold">{waitingCustomers.length}</div>
                    <div className="text-sm text-gray-600">Currently Waiting</div>
                  </div>
                  
                  <div className="bg-salon-secondary/20 p-4 rounded-lg">
                    <div className="text-lg font-bold">{turnedAwayCustomers.length}</div>
                    <div className="text-sm text-gray-600">Turned Away</div>
                  </div>
                  
                  <div className="bg-salon-orange/20 p-4 rounded-lg">
                    <div className="text-lg font-bold">{averageWaitTime.toFixed(1)}s</div>
                    <div className="text-sm text-gray-600">Avg Wait Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="booking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Book a Haircut</CardTitle>
                <CardDescription>
                  Enter customer information to add them to the queue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleBooking} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter name"
                      />
                    </div>
                  </div>
                  <Button type="submit">
                    Book Appointment
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Customer History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h3 className="font-medium">Served Customers ({servedCustomers.length})</h3>
                  <div className="max-h-[200px] overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          <th className="p-2">ID</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Barber</th>
                          <th className="p-2">Wait Time</th>
                          <th className="p-2">Service Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servedCustomers.map((customer) => (
                          <tr key={customer.id} className="border-t">
                            <td className="p-2">{customer.id}</td>
                            <td className="p-2">{customer.name}</td>
                            <td className="p-2">#{customer.servedBy}</td>
                            <td className="p-2">
                              {((customer.timeServed || 0) - customer.timeArrived).toFixed(1)}s
                            </td>
                            <td className="p-2">
                              {((customer.timeLeft || 0) - (customer.timeServed || 0)).toFixed(1)}s
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {servedCustomers.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        No customers served yet
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-medium mt-6">Turned Away Customers ({turnedAwayCustomers.length})</h3>
                  <div className="max-h-[200px] overflow-y-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          <th className="p-2">ID</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Time Arrived</th>
                        </tr>
                      </thead>
                      <tbody>
                        {turnedAwayCustomers.map((customer) => (
                          <tr key={customer.id} className="border-t">
                            <td className="p-2">{customer.id}</td>
                            <td className="p-2">{customer.name}</td>
                            <td className="p-2">{formatTime(customer.timeArrived)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {turnedAwayCustomers.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        No customers turned away yet
                      </div>
                    )}
                  </div>
                </div>
              </Card
