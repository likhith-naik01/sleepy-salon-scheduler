import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Users, Scissors, Info, Play, Circle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

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
  serviceEndTime?: number; // Track when service will finish
}

interface Barber {
  id: number;
  state: BarberState;
  servingCustomerId: number | null;
  totalCustomersServed: number;
  currentServiceStartTime?: number;
  serviceEndTime?: number; // Track when service will finish
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
  
  // Animation frame reference
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
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
    // Create initial barbers - all in sleeping state
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
    
    // Stop any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
    initializeSimulation();
    
    toast({
      title: "Simulation Reset",
      description: "All barbers are now sleeping and waiting for customers.",
    });
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
    
    // When a customer arrives, check if there are any sleeping barbers
    const sleepingBarberId = barbers.findIndex(b => b.state === BarberState.SLEEPING);
    
    // If there's a sleeping barber, wake them up to serve this customer immediately
    if (sleepingBarberId !== -1) {
      // Wake up the barber and assign the customer
      const updatedBarbers = [...barbers];
      
      // Calculate when service will end based on service time
      const serviceEndTime = currentTime + serviceTime;
      
      updatedBarbers[sleepingBarberId] = {
        ...updatedBarbers[sleepingBarberId],
        state: BarberState.WORKING,
        servingCustomerId: nextId,
        currentServiceStartTime: currentTime,
        serviceEndTime: serviceEndTime,
      };

      const newCustomer: Customer = {
        id: nextId,
        name: name,
        state: CustomerState.GETTING_HAIRCUT,
        timeArrived: currentTime,
        timeServed: currentTime,
        servedBy: sleepingBarberId + 1,
        serviceEndTime: serviceEndTime
      };

      setBarbers(updatedBarbers);
      setCurrentCustomers(prev => [...prev, newCustomer]);
      setNextCustomerId(nextId + 1);
      
      toast({
        title: "Customer Seated",
        description: `${name} is now getting a haircut from Barber #${sleepingBarberId + 1}`
      });
      
      // Start simulation if it's not running
      if (!isRunning) {
        setIsRunning(true);
        lastTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(animationLoop);
      }
    } 
    // Otherwise, if all barbers are busy,
    // add to waiting queue if there's space
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
  
  // Start haircuts button function
  const startHaircuts = () => {
    // Check if we have any barbers
    if (barbers.length === 0) {
      initializeSimulation();
    }
    
    // Get all sleeping barbers
    const sleepingBarberIndices = barbers
      .map((barber, index) => barber.state === BarberState.SLEEPING ? index : -1)
      .filter(index => index !== -1);
    
    if (sleepingBarberIndices.length === 0 && waitingCustomers.length === 0) {
      toast({
        title: "All barbers are working",
        description: "All barbers are currently busy serving customers.",
      });
      return;
    }
    
    // Start simulation timer if it's not already running
    if (!isRunning) {
      setIsRunning(true);
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animationLoop);
    }
    
    // For each sleeping barber, assign a customer if available
    assignCustomersToBarbers();
  };
  
  // Assign waiting customers to any available barbers - improved
  const assignCustomersToBarbers = () => {
    if (waitingCustomers.length === 0) return false;
    
    // Get all sleeping barbers
    const sleepingBarberIndices = barbers
      .map((barber, index) => barber.state === BarberState.SLEEPING ? index : -1)
      .filter(index => index !== -1);
    
    if (sleepingBarberIndices.length === 0) return false;
    
    // For each sleeping barber, assign a customer if available
    const updatedBarbers = [...barbers];
    let customersAssigned = false;
    const customersToRemove: number[] = [];
    
    for (const barberIndex of sleepingBarberIndices) {
      if (waitingCustomers.length > 0) {
        // Get next waiting customer
        const nextCustomer = waitingCustomers[0];
        customersToRemove.push(nextCustomer.id);
        
        // Calculate when service will end based on service time
        const serviceEndTime = currentTime + serviceTime;
        
        // Update barber state
        updatedBarbers[barberIndex] = {
          ...updatedBarbers[barberIndex],
          state: BarberState.WORKING,
          servingCustomerId: nextCustomer.id,
          currentServiceStartTime: currentTime,
          serviceEndTime: serviceEndTime,
        };
        
        // Mark this customer as being served
        const updatedNextCustomer = {
          ...nextCustomer,
          state: CustomerState.GETTING_HAIRCUT,
          timeServed: currentTime,
          servedBy: barberIndex + 1,
          serviceEndTime: serviceEndTime,
          waitingPosition: undefined
        };
        
        // Add to serving list
        setCurrentCustomers(prev => [...prev, updatedNextCustomer]);
        
        toast({
          title: "Haircut Started",
          description: `${nextCustomer.name} is now being served by Barber #${barberIndex + 1}.`,
        });
        
        customersAssigned = true;
      }
    }
    
    // Remove assigned customers from waiting list
    if (customersAssigned) {
      const remainingWaiting = waitingCustomers.filter(c => !customersToRemove.includes(c.id));
      
      // Update waiting positions for remaining customers
      const updatedWaiting = remainingWaiting.map((customer, idx) => ({
        ...customer,
        waitingPosition: idx
      }));
      
      setWaitingCustomers(updatedWaiting);
    }
    
    // Update barber states
    setBarbers(updatedBarbers);
    return customersAssigned;
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
  
  // Calculate service progress as a percentage - IMPROVED
  const getServiceProgress = (barber: Barber): number => {
    if (barber.state !== BarberState.WORKING || 
        !barber.currentServiceStartTime || 
        !barber.serviceEndTime) {
      return 0;
    }
    
    // Calculate the exact progress percentage based on elapsed time vs total service time
    const totalServiceTime = barber.serviceEndTime - barber.currentServiceStartTime;
    const elapsedTime = currentTime - barber.currentServiceStartTime;
    
    // Ensure progress is between 0-100%
    const progress = Math.min(100, Math.max(0, (elapsedTime / totalServiceTime) * 100));
    return progress;
  };
  
  // Get customer by ID
  const getCustomerById = (id: number | null): Customer | undefined => {
    if (id === null) return undefined;
    return currentCustomers.find(c => c.id === id);
  };
  
  // Process a time step in the simulation - IMPROVED FOR EXACT TIMING
  const processTimeStep = (timeStep: number) => {
    if (!isRunning) return;
    
    const newTime = currentTime + timeStep;
    setCurrentTime(newTime);
    
    // Check for finishing haircuts
    let updatedBarbers = [...barbers];
    const finishedCustomers: Customer[] = [];
    const updatedCurrentCustomers = [...currentCustomers];
    const customersToRemove: number[] = [];
    
    // Process each customer currently being served
    currentCustomers.forEach(customer => {
      if (customer.state === CustomerState.GETTING_HAIRCUT && customer.serviceEndTime) {
        const barberId = customer.servedBy! - 1;
        
        // If haircut is finished (check if we've reached serviceEndTime)
        if (newTime >= customer.serviceEndTime) {
          // Mark customer as served and add to finished list
          const finishedCustomer = {
            ...customer,
            state: CustomerState.SERVED,
            timeLeft: customer.serviceEndTime // Use exact service end time
          };
          
          // Add to finished customers list
          finishedCustomers.push(finishedCustomer);
          customersToRemove.push(customer.id);
          
          // Update barber's total customers served count
          updatedBarbers[barberId] = {
            ...updatedBarbers[barberId],
            totalCustomersServed: updatedBarbers[barberId].totalCustomersServed + 1,
            servingCustomerId: null
          };
          
          // Check if there's another waiting customer
          if (waitingCustomers.length > 0) {
            // Get the next waiting customer
            const nextCustomer = { ...waitingCustomers[0] };
            
            // Calculate service end time for the next customer
            const nextServiceEndTime = newTime + serviceTime;
            
            // Update next customer state
            const updatedNextCustomer = {
              ...nextCustomer,
              state: CustomerState.GETTING_HAIRCUT,
              timeServed: newTime,
              servedBy: barberId + 1,
              serviceEndTime: nextServiceEndTime,
              waitingPosition: undefined
            };
            
            // Update barber state - keep working with new customer
            updatedBarbers[barberId] = {
              ...updatedBarbers[barberId],
              servingCustomerId: nextCustomer.id,
              currentServiceStartTime: newTime,
              serviceEndTime: nextServiceEndTime,
              state: BarberState.WORKING
            };
            
            // Add next customer to current customers list
            updatedCurrentCustomers.push(updatedNextCustomer);
            
            // Remove next customer from waiting list
            const newWaiting = waitingCustomers.slice(1).map((c, idx) => ({
              ...c,
              waitingPosition: idx
            }));
            
            setWaitingCustomers(newWaiting);
            
            // Show toast notification
            toast({
              title: "Next Customer",
              description: `${finishedCustomer.name} finished haircut. ${nextCustomer.name} is now with Barber #${barberId + 1}.`
            });
          } else {
            // No customers waiting, barber goes to sleep
            updatedBarbers[barberId] = {
              ...updatedBarbers[barberId],
              state: BarberState.SLEEPING,
              servingCustomerId: null,
              currentServiceStartTime: undefined,
              serviceEndTime: undefined
            };
            
            // Show toast notification
            toast({
              title: "Haircut Complete",
              description: `${customer.name} finished their haircut. Barber #${barberId + 1} is now sleeping as there are no more customers.`
            });
          }
        }
      }
    });
    
    // Remove finished customers from current customers list
    const remainingCustomers = updatedCurrentCustomers.filter(
      customer => !customersToRemove.includes(customer.id)
    );
    
    // Update all state
    setBarbers(updatedBarbers);
    setCurrentCustomers(remainingCustomers);
    
    // Add newly served customers to the statistics
    if (finishedCustomers.length > 0) {
      setServedCustomers(prev => [...prev, ...finishedCustomers]);
    }
    
    // Add random customer after state update if probability hits and simulation is running
    if (Math.random() < (arrivalRate / 60) * timeStep && isRunning) {
      addRandomCustomer();
    }
  };
  
  // Add a random customer to the salon
  const addRandomCustomer = () => {
    const randomNames = ["Alex", "Sam", "Jamie", "Taylor", "Jordan", "Casey", "Avery", "Riley", "Quinn", "Morgan"];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + " " + nextCustomerId;
    addCustomerWithName(randomName);
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
                  <Button 
                    variant="success" 
                    onClick={startHaircuts} 
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="h-4 w-4" />
                    Start Haircuts
                  </Button>
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
                      {barbers.map((barber) => {
                        const customer = getCustomerById(barber.servingCustomerId);
                        const serviceProgress = getServiceProgress(barber);
                        
                        return (
                          <div key={barber.id} className="relative">
                            <div className={`barber p-4 rounded-lg border ${barber.state === BarberState.SLEEPING ? 'bg-gray-100' : 'bg-green-50 border-green-200'}`}>
                              <div className="flex flex-col items-center space-y-2">
                                <Scissors className={`w-6 h-6 ${barber.state === BarberState.SLEEPING ? 'text-gray-400' : 'text-green-600'}`} />
                                <div className="mt-2 text-center text-sm font-medium">
                                  Barber #{barber.id}
                                </div>
                                <div className={`text-xs text-center font-medium ${barber.state === BarberState.SLEEPING ? 'text-gray-500' : 'text-green-600'}`}>
                                  {barber.state === BarberState.SLEEPING ? 'Sleeping' : 'Working'}
                                </div>
                                <div className="text-xs">
                                  Customers Served: {barber.totalCustomersServed}
                                </div>
                                
                                {barber.state === BarberState.WORKING && customer && (
                                  <div className="mt-2 w-full">
                                    <div className="relative pt-1">
                                      <div className="text-xs text-center mb-1 font-medium">{customer.name}</div>
                                      <Progress value={serviceProgress} className="h-2" />
                                      <div className="text-xs text-center mt-1">
                                        {Math.round(serviceProgress)}% complete
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {barber.servingCustomerId && (
                              <div className="absolute -right-4 -top-4">
                                <div className="customer bg-blue-500 text-white p-2 rounded-full">
                                  <User className="w-4 h-4" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
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
                    <div className="waiting-area min-h-[200px] max-h-[400px] overflow-y-auto bg-slate-50 p-3 rounded-md border border-slate-200">
                      {waitingCustomers.map((customer, index) => (
                        <div key={customer.id} className="flex items-center gap-2 p-2 mb-2 bg-white rounded-md shadow-sm">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium truncate">{customer.name}</div>
                            <div className="text-xs text-gray-500">Position: {index + 1}</div>
                            <div className="text-xs text-gray-500">
                              Waiting for: {formatTime(currentTime - customer.timeArrived)}
                            </div>
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
                  <div className="bg-green-100 p-4 rounded-lg">
                    <div className="text-lg font-bold">{servedCustomers.length}</div>
                    <div className="text-sm text-gray-600">Customers Served</div>
                  </div>
                  
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <div className="text-lg font-bold">{waitingCustomers.length}</div>
                    <div className="text-sm text-gray-600">Currently Waiting</div>
                  </div>
                  
                  <div className="bg-red-100 p-4 rounded-lg">
                    <div className="text-lg font-bold">{turnedAwayCustomers.length}</div>
                    <div className="text-sm text-gray-600">Turned Away</div>
                  </div>
                  
                  <div className="bg-yellow-100 p-4 rounded-lg">
                    <div className="text-lg font-bold">{averageWaitTime.toFixed(1)}s</div>
                    <div className="text-sm text-gray-600">Avg Wait Time</div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-medium mb-3">Recent Completed Haircuts</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Barber</TableHead>
                        <TableHead>Wait Time</TableHead>
                        <TableHead>Service Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servedCustomers.slice(-5).reverse().map(customer => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>#{customer.servedBy}</TableCell>
                          <TableCell>{((customer.timeServed || 0) - customer.timeArrived).toFixed(1)}s</TableCell>
                          <TableCell>{((customer.timeLeft || 0) - (customer.timeServed || 0)).toFixed(1)}s</TableCell>
                        </TableRow>
                      ))}
                      {servedCustomers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                            No customers have been served yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
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
                <form onSubmit={handleBooking}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter customer name"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="success">
                      Add Customer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="explanation" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  The Sleeping Barber Problem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  The Sleeping Barber Problem is a classic synchronization problem in computer science and operating systems. It involves a barber shop with a fixed number of barbers and chairs. Customers arrive at the shop and wait in a queue until a barber is available to serve them. The barber must alternate between sleeping and serving customers, and the problem arises when a new customer arrives while the barber is already serving another customer.
                </p>
                <p>
                  The problem can be solved using various synchronization techniques, such as semaphores, mutexes, and condition variables. The goal is to ensure that the barber does not wake up and serve a new customer before the current customer has finished their haircut, and that the barber does not fall asleep while there are still customers waiting.
                </p>
                <p>
                  The Sleeping Barber Problem is a fundamental example of how synchronization issues can arise in concurrent programming and how they can be addressed using appropriate synchronization mechanisms.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
