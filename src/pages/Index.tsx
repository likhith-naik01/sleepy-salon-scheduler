import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Users, Scissors, Info, Play } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
    
    if (sleepingBarberIndices.length === 0) {
      toast({
        title: "All barbers are working",
        description: "All barbers are currently busy serving customers.",
      });
      return;
    }
    
    // For each sleeping barber, assign a customer if available
    const updatedBarbers = [...barbers];
    
    for (const barberIndex of sleepingBarberIndices) {
      if (waitingCustomers.length > 0) {
        // Get next waiting customer
        const nextCustomer = waitingCustomers[0];
        
        // Calculate when service will end based on service time
        const serviceEndTime = currentTime + serviceTime;
        
        // Update barber state
        updatedBarbers[barberIndex] = {
          ...updatedBarbers[barberIndex],
          state: BarberState.WORKING,
          servingCustomerId: nextCustomer.id,
          currentServiceStartTime: currentTime,
          serviceEndTime: serviceEndTime,
          // Don't increment served count yet, do it when haircut completes
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
        
        // Add to serving list and track for removal from waiting
        setCurrentCustomers(prev => [...prev, updatedNextCustomer]);
        
        toast({
          title: "Haircut Started",
          description: `${nextCustomer.name} is now being served by Barber #${barberIndex + 1}.`,
        });
        
        // Remove this customer from waiting list
        const remainingWaiting = waitingCustomers.filter(c => c.id !== nextCustomer.id);
        
        // Update waiting positions for remaining customers
        const updatedWaiting = remainingWaiting.map((customer, idx) => ({
          ...customer,
          waitingPosition: idx
        }));
        
        setWaitingCustomers(updatedWaiting);
      }
    }
    
    // Update barber states
    setBarbers(updatedBarbers);
    
    // Start simulation timer if it's not already running
    if (!isRunning) {
      setIsRunning(true);
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animationLoop);
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
    
    // When a customer arrives, check if there are any sleeping barbers
    const sleepingBarberId = barbers.findIndex(b => b.state === BarberState.SLEEPING);
    
    // If there's a sleeping barber, wake them up to serve this customer immediately
    if (sleepingBarberId !== -1 && isRunning) {
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
        // Don't increment served count yet
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
    } 
    // Otherwise, if all barbers are busy or simulation isn't running,
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
  
  // Add a random customer to the salon
  const addRandomCustomer = () => {
    const randomNames = ["Alex", "Sam", "Jamie", "Taylor", "Jordan", "Casey", "Avery", "Riley", "Quinn", "Morgan"];
    const randomName = randomNames[Math.floor(Math.random() * randomNames.length)] + " " + nextCustomerId;
    addCustomerWithName(randomName);
  };
  
  // Process a time step in the simulation
  const processTimeStep = (timeStep: number) => {
    if (!isRunning) return;
    
    const newTime = currentTime + timeStep;
    
    // Check for finishing haircuts
    const updatedBarbers = [...barbers];
    const finishedCustomers: Customer[] = [];
    const stillServingCustomers: Customer[] = [];
    
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
            timeLeft: newTime
          };
          
          // Add to finished customers list to update stats
          finishedCustomers.push(finishedCustomer);
          
          // Check if there's another waiting customer
          if (waitingCustomers.length > 0) {
            // Get the next waiting customer
            const nextCustomer = waitingCustomers[0];
            
            // Calculate service end time for the next customer
            const nextServiceEndTime = newTime + serviceTime;
            
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
              // Increment served count when haircut is completed
              totalCustomersServed: updatedBarbers[barberId].totalCustomersServed + 1
            };
            
            // Add customer to currently being served
            stillServingCustomers.push(updatedNextCustomer);
            
            toast({
              title: "Haircut Complete",
              description: `${customer.name} finished their haircut. ${nextCustomer.name} is now being served by Barber #${barberId + 1}.`,
              variant: "success"
            });
            
            // Update waiting queue by removing the first customer
            setWaitingCustomers(prev => {
              const newWaiting = prev.slice(1).map((c, idx) => ({
                ...c,
                waitingPosition: idx
              }));
              return newWaiting;
            });
          } else {
            // No customers waiting, barber goes to sleep
            updatedBarbers[barberId] = {
              ...updatedBarbers[barberId],
              state: BarberState.SLEEPING,
              servingCustomerId: null,
              currentServiceStartTime: undefined,
              serviceEndTime: undefined,
              // Increment served count when haircut is completed
              totalCustomersServed: updatedBarbers[barberId].totalCustomersServed + 1
            };
            
            toast({
              title: "Haircut Complete",
              description: `${customer.name} finished their haircut. Barber #${barberId + 1} is now sleeping as there are no more customers.`,
              variant: "success"
            });
          }
        } else {
          // Customer still getting haircut
          stillServingCustomers.push(customer);
        }
      }
    });
    
    // Update state with all changes
    setCurrentTime(newTime);
    setBarbers(updatedBarbers);
    setCurrentCustomers(stillServingCustomers);
    
    // Add newly served customers to the statistics immediately
    if (finishedCustomers.length > 0) {
      setServedCustomers(prev => [...prev, ...finishedCustomers]);
    }
    
    // Add random customer after state update if probability hits and simulation is running
    if (Math.random() < (arrivalRate / 60) * timeStep && isRunning) {
      addRandomCustomer();
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
                    className="flex items-center gap-2"
                  >
                    <Scissors className="h-4 w-4" />
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
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="explanation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  The Sleeping Barber Problem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p>
                    The Sleeping Barber Problem is a classic synchronization problem in operating systems that illustrates concurrent programming challenges.
                  </p>
                  
                  <h3>Problem Description</h3>
                  <p>
                    A barbershop has:
                  </p>
                  <ul>
                    <li>One or more barbers who cut hair one customer at a time</li>
                    <li>A waiting room with limited chairs</li>
                    <li>Customers who arrive randomly</li>
                  </ul>
                  
                  <p>When there are no customers, the barber sleeps (goes idle). When a customer arrives:</p>
                  <ul>
                    <li>If the barber is sleeping, the customer wakes them up for a haircut</li>
                    <li>If the barber is busy but chairs are available, the customer waits</li>
                    <li>If all chairs are occupied, the customer leaves</li>
                  </ul>
                  
                  <h3>Operating System Concepts Illustrated</h3>
                  <ul>
                    <li><strong>Mutual Exclusion:</strong> Only one process (barber) can access a resource (chair) at a time</li>
                    <li><strong>Semaphores:</strong> Used to signal when customers are waiting or when the barber is ready</li>
                    <li><strong>Process Coordination:</strong> Barbers and customers must coordinate their actions</li>
                    <li><strong>Deadlock Prevention:</strong> The system must avoid situations where processes wait indefinitely</li>
                  </ul>
                  
                  <h3>In This Simulation</h3>
                  <p>
                    Our interactive simulation allows you to:
                  </p>
                  <ul>
                    <li>Adjust the number of barbers to see how it affects throughput</li>
                    <li>Change the waiting room capacity</li>
                    <li>Control customer arrival rates</li>
                    <li>Observe the system behavior over time with statistics</li>
                  </ul>
                  
                  <p>
                    Try experimenting with different configurations to observe how these parameters affect the efficiency of the system!
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
