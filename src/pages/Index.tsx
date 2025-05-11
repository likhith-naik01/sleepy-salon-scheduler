import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Users, Scissors, Info, Play, Pause, Bell, BellRing, Code } from "lucide-react";
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
  const [isPaused, setIsPaused] = useState(false);
  
  // Simulation state
  const [currentTime, setCurrentTime] = useState(0);
  const [nextCustomerId, setNextCustomerId] = useState(1);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [waitingCustomers, setWaitingCustomers] = useState<Customer[]>([]);
  const [currentCustomers, setCurrentCustomers] = useState<Customer[]>([]);
  const [servedCustomers, setServedCustomers] = useState<Customer[]>([]);
  const [turnedAwayCustomers, setTurnedAwayCustomers] = useState<Customer[]>([]);
  
  // Interactive visualization states
  const [lastActiveBarber, setLastActiveBarber] = useState<number | null>(null);
  const [lastServedCustomer, setLastServedCustomer] = useState<number | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Customer input fields
  const [customerName, setCustomerName] = useState('');
  
  // Animation frame reference
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const secondTickRef = useRef<number>(0);
  
  // Metrics - Fix average wait time calculation
  const averageWaitTime = React.useMemo(() => {
    if (servedCustomers.length === 0) return 0;
    
    // Calculate wait time for each served customer (from arrival to when they started their haircut)
    const totalWaitTime = servedCustomers.reduce((total, customer) => {
      // Only count the actual waiting time (from arrival until they were served)
      // This excludes the haircut service time itself
      const waitTime = ((customer.timeServed || customer.timeArrived) - customer.timeArrived);
      return total + waitTime;
    }, 0);
    
    // Round to 1 decimal place for display
    return Math.round((totalWaitTime / servedCustomers.length) * 10) / 10;
  }, [servedCustomers]);
  
  // Initialize simulation
  useEffect(() => {
    initializeSimulation();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
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
    setIsPaused(false);
    setLastActiveBarber(null);
    setLastServedCustomer(null);
    setNotificationCount(0);
    
    // Stop any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };
  
  // Reset simulation
  const resetSimulation = () => {
    setIsRunning(false);
    setIsPaused(false);
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
  
  // Toggle pause/resume simulation
  const togglePauseSimulation = () => {
    if (isRunning) {
      setIsPaused(!isPaused);
      
      if (isPaused) {
        // Resuming simulation
        toast({
          title: "Simulation Resumed",
          description: "Haircuts and customer flow will continue.",
        });
        lastTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(animationLoop);
      } else {
        // Pausing simulation
        toast({
          title: "Simulation Paused",
          description: "Haircuts and customer flow are now paused.",
        });
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    }
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
      setLastActiveBarber(sleepingBarberId);
      setLastServedCustomer(nextId);
      setNotificationCount(prev => prev + 1);
      
      toast({
        title: "Barber Woke Up!",
        description: `${name} has woken up Barber #${sleepingBarberId + 1} who is now giving a haircut!`
      });
      
      // Start simulation if it's not running
      if (!isRunning) {
        setIsRunning(true);
        setIsPaused(false);
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
      setNotificationCount(prev => prev + 1);
      
      toast({
        title: "Added to Waiting List",
        description: `${name} is now waiting (position #${waitingCustomers.length + 1})`
      });
      
      // Start simulation if it's not running
      if (!isRunning) {
        setIsRunning(true);
        setIsPaused(false);
        lastTimeRef.current = performance.now();
        animationRef.current = requestAnimationFrame(animationLoop);
      }
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
      setNotificationCount(prev => prev + 1);
      
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
      setIsPaused(false);
      lastTimeRef.current = performance.now();
      secondTickRef.current = 0;
      animationRef.current = requestAnimationFrame(animationLoop);
      
      toast({
        title: "Simulation Started",
        description: "Barbers will now serve customers.",
      });
    } else if (isPaused) {
      // Resume if paused
      setIsPaused(false);
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animationLoop);
      
      toast({
        title: "Simulation Resumed",
        description: "Barbers will continue serving customers.",
      });
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
        
        // Update interactive state
        setLastActiveBarber(barberIndex);
        setLastServedCustomer(nextCustomer.id);
        
        toast({
          title: "Barber Woke Up!",
          description: `${nextCustomer.name} has woken up Barber #${barberIndex + 1} who is now giving a haircut!`
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
    if (!isRunning || isPaused) return;
    
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Scale time based on simulation speed (convert ms to seconds)
    const timeStep = (deltaTime / 1000) * simulationSpeed;
    
    // Update second tick counter
    secondTickRef.current += timeStep;
    
    // If a full second has passed, check if we need to update any UI elements
    if (secondTickRef.current >= 1) {
      secondTickRef.current = 0;
      
      // Reset last active indicators after a second for visual feedback
      if (lastActiveBarber !== null || lastServedCustomer !== null) {
        setTimeout(() => {
          setLastActiveBarber(null);
          setLastServedCustomer(null);
        }, 1000);
      }
    }
    
    processTimeStep(timeStep);
    animationRef.current = requestAnimationFrame(animationLoop);
  };
  
  // Handle service completion when progress bar reaches 100%
  const handleServiceComplete = (barberId: number) => {
    // Find the barber in our state
    const barberIndex = barbers.findIndex(b => b.id === barberId);
    if (barberIndex === -1) return;
    
    const barber = barbers[barberIndex];
    if (!barber.servingCustomerId) return;

    // Find the customer being served by this barber
    const customerIndex = currentCustomers.findIndex(c => c.id === barber.servingCustomerId);
    if (customerIndex === -1) return;
    
    const customer = currentCustomers[customerIndex];
    
    // Update customer as served
    const finishedCustomer = {
      ...customer,
      state: CustomerState.SERVED,
      timeLeft: currentTime
    };
    
    // Add to served customers list
    setServedCustomers(prev => [...prev, finishedCustomer]);
    
    // Remove from current customers
    const updatedCurrentCustomers = currentCustomers.filter(c => c.id !== customer.id);
    setCurrentCustomers(updatedCurrentCustomers);
    
    // Update barber's total customers served count
    const updatedBarbers = [...barbers];
    updatedBarbers[barberIndex] = {
      ...updatedBarbers[barberIndex],
      totalCustomersServed: barber.totalCustomersServed + 1,
      servingCustomerId: null,
      state: BarberState.SLEEPING
    };
    
    setBarbers(updatedBarbers);
    
    // Check if there's another waiting customer
    if (waitingCustomers.length > 0) {
      // Get the next waiting customer
      const nextCustomer = { ...waitingCustomers[0] };
      
      // Calculate service end time for the next customer
      const nextServiceEndTime = currentTime + serviceTime;
      
      // Update next customer state
      const updatedNextCustomer = {
        ...nextCustomer,
        state: CustomerState.GETTING_HAIRCUT,
        timeServed: currentTime,
        servedBy: barberId,
        serviceEndTime: nextServiceEndTime,
        waitingPosition: undefined
      };
      
      // Update barber state - keep working with new customer
      updatedBarbers[barberIndex] = {
        ...updatedBarbers[barberIndex],
        servingCustomerId: nextCustomer.id,
        currentServiceStartTime: currentTime,
        serviceEndTime: nextServiceEndTime,
        state: BarberState.WORKING
      };
      
      // Add next customer to current customers list
      setCurrentCustomers(prev => [...prev, updatedNextCustomer]);
      
      // Remove next customer from waiting list and update waiting positions
      const newWaiting = waitingCustomers.slice(1).map((c, idx) => ({
        ...c,
        waitingPosition: idx
      }));
      
      setWaitingCustomers(newWaiting);
      
      // Update interactive state
      setLastActiveBarber(barberIndex);
      setLastServedCustomer(nextCustomer.id);
      
      // Show toast notification
      toast({
        title: "Next Customer",
        description: `${finishedCustomer.name} finished haircut. ${nextCustomer.name} is now with Barber #${barberId}.`
      });
    } else {
      // No customers waiting, barber goes to sleep
      updatedBarbers[barberIndex] = {
        ...updatedBarbers[barberIndex],
        state: BarberState.SLEEPING,
        servingCustomerId: null,
        currentServiceStartTime: undefined,
        serviceEndTime: undefined
      };
      
      // Show toast notification
      toast({
        title: "Barber Sleeping",
        description: `${customer.name} finished their haircut. Barber #${barberId} is now sleeping as there are no more customers.`
      });
    }
    
    // Increment notification count
    setNotificationCount(prev => prev + 1);
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

  // Calculate time remaining for a haircut in seconds
  const getTimeRemaining = (barber: Barber): number => {
    if (barber.state !== BarberState.WORKING || !barber.serviceEndTime) {
      return 0;
    }
    
    const timeRemaining = Math.max(0, barber.serviceEndTime - currentTime);
    return Math.round(timeRemaining * 10) / 10; // Round to 1 decimal place
  };
  
  // Get customer by ID
  const getCustomerById = (id: number | null): Customer | undefined => {
    if (id === null) return undefined;
    return currentCustomers.find(c => c.id === id);
  };
  
  // Process a time step in the simulation - IMPROVED FOR EXACT TIMING
  const processTimeStep = (timeStep: number) => {
    if (!isRunning || isPaused) return;
    
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
          
          // Increment notification count
          setNotificationCount(prev => prev + 1);
          
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
            
            // Update interactive state
            setLastActiveBarber(barberId);
            setLastServedCustomer(nextCustomer.id);
            
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
              title: "Barber Sleeping",
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
    if (Math.random() < (arrivalRate / 60) * timeStep && isRunning && !isPaused) {
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
        <header className="mb-8 text-center relative">
          <div className="absolute right-0 top-0">
            <div className="relative">
              {notificationCount > 0 && (
                <div className="absolute -right-1 -top-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                </div>
              )}
              <BellRing className={`h-6 w-6 ${notificationCount > 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-purple-600 mb-2">Sleeping Barber Simulation</h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            An interactive visualization of the classic operating system synchronization problem
          </p>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800">
            <Clock className="mr-1 h-4 w-4" /> Simulation Time: {formatTime(currentTime)}
          </div>
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
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
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
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  Updates every second - Interactive visualization
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetSimulation}>
                    Reset
                  </Button>
                  {isRunning && !isPaused ? (
                    <Button 
                      variant="secondary" 
                      onClick={togglePauseSimulation}
                      className="flex items-center gap-2"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button 
                      variant="success" 
                      onClick={startHaircuts} 
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Play className="h-4 w-4" />
                      {isPaused ? "Resume" : "Start Haircuts"}
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
                      {barbers.map((barber, index) => {
                        const customer = getCustomerById(barber.servingCustomerId);
                        const serviceProgress = getServiceProgress(barber);
                        const timeRemaining = getTimeRemaining(barber);
                        const isActive = lastActiveBarber === index;
                        
                        return (
                          <div 
                            key={barber.id} 
                            className={`relative transition-all duration-300 ${isActive ? 'scale-105' : ''}`}
                          >
                            <div 
                              className={`barber p-4 rounded-lg border shadow-md transition-all duration-300 ${
                                barber.state === BarberState.SLEEPING 
                                  ? 'bg-gray-100 border-gray-200' 
                                  : isActive 
                                    ? 'bg-green-100 border-green-400 shadow-lg' 
                                    : 'bg-green-50 border-green-200'
                              }`}
                            >
                              <div className="flex flex-col items-center space-y-2">
                                <Scissors 
                                  className={`w-6 h-6 transition-all duration-300 ${
                                    barber.state === BarberState.SLEEPING 
                                      ? 'text-gray-400' 
                                      : isActive 
                                        ? 'text-green-700 animate-pulse' 
                                        : 'text-green-600'
                                  }`} 
                                />
                                <div className="mt-2 text-center text-sm font-medium">
                                  Barber #{barber.id}
                                </div>
                                <div 
                                  className={`px-2 py-1 rounded-full text-xs text-center font-medium ${
                                    barber.state === BarberState.SLEEPING 
                                      ? 'bg-gray-200 text-gray-700' 
                                      : 'bg-green-200 text-green-800'
                                  }`}
                                >
                                  {barber.state === BarberState.SLEEPING ? 'Sleeping' : 'Working'}
                                </div>
                                <div className="text-xs border-t border-dashed border-gray-200 pt-1 mt-1 w-full text-center">
                                  Customers Served: {barber.totalCustomersServed}
                                </div>
                                
                                {barber.state === BarberState.WORKING && customer && (
                                  <div className="mt-2 w-full animate-fade-in">
                                    <div className="relative pt-1">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="text-xs font-medium">{customer.name}</div>
                                        <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                          {timeRemaining.toFixed(1)}s left
                                        </div>
                                      </div>
                                      <Progress 
                                        value={serviceProgress} 
                                        className={`h-3 ${isActive ? 'bg-green-200' : ''}`}
                                        onComplete={() => handleServiceComplete(barber.id)}
                                        duration={timeRemaining} // Use the actual time remaining as the duration
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {barber.servingCustomerId && (
                              <div className="absolute -right-4 -top-4">
                                <div 
                                  className={`${
                                    lastServedCustomer === barber.servingCustomerId 
                                      ? 'bg-blue-600 animate-pulse' 
                                      : 'bg-blue-500'
                                  } text-white p-2 rounded-full flex items-center justify-center shadow-md`}
                                >
                                  <User className="w-4 h-4" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {barbers.length === 0 && (
                        <div className="w-full text-center py-12 text-gray-500">
                          No barbers available. Press "Start Haircuts" to initialize the simulation.
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Waiting Area */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      <div className="flex items-center justify-between">
                        <span>Waiting Area ({waitingCustomers.length}/{numChairs})</span>
                        {waitingCustomers.length > 0 && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Customers Waiting
                          </span>
                        )}
                      </div>
                    </h3>
                    <div className="waiting-area min-h-[200px] max-h-[400px] overflow-y-auto bg-slate-50 p-3 rounded-md border border-slate-200 shadow-inner">
                      {waitingCustomers.map((customer, index) => {
                        const waitingTime = currentTime - customer.timeArrived;
                        let urgencyColor = 'bg-blue-100 text-blue-800';
                        if (waitingTime > 30) urgencyColor = 'bg-red-100 text-red-800';
                        else if (waitingTime > 15) urgencyColor = 'bg-yellow-100 text-yellow-800';
                        
                        return (
                          <div 
                            key={customer.id} 
                            className="flex items-center gap-2 p-2 mb-2 bg-white rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                              <User className="w-4 h-4" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="text-sm font-medium truncate">{customer.name}</div>
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-gray-500">Position: {index + 1}</div>
                                <div className={`text-xs px-1.5 py-0.5 rounded-full ${urgencyColor}`}>
                                  {formatTime(waitingTime)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {waitingCustomers.length === 0 && (
                        <div className="text-center py-8 text-gray-500 animate-pulse">
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
                  <div className="bg-green-100 p-4 rounded-lg shadow-sm">
                    <div className="text-lg font-bold">{servedCustomers.length}</div>
                    <div className="text-sm text-gray-600">Customers Served</div>
                  </div>
                  
                  <div className="bg-blue-100 p-4 rounded-lg shadow-sm">
                    <div className="text-lg font-bold">{waitingCustomers.length}</div>
                    <div className="text-sm text-gray-600">Currently Waiting</div>
                  </div>
                  
                  <div className="bg-red-100 p-4 rounded-lg shadow-sm">
                    <div className="text-lg font-bold">{turnedAwayCustomers.length}</div>
                    <div className="text-sm text-gray-600">Turned Away</div>
                  </div>
                  
                  <div className="bg-yellow-100 p-4 rounded-lg shadow-sm">
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
                  <div className="flex justify-end mt-4">
                    <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
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
                <Alert className="mb-4 bg-purple-50 border-purple-200">
                  <AlertTitle className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" /> What is the Sleeping Barber Problem?
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    The Sleeping Barber Problem is a classic synchronization problem in computer science used to illustrate
                    inter-process communication and synchronization between multiple operating system processes.
                  </AlertDescription>
                </Alert>
                
                <p className="mb-4">
                  The Sleeping Barber Problem involves a barbershop with a limited number of chairs and one or more barbers. 
                  When there are no customers, the barber goes to sleep (becomes idle). When a customer arrives, they either:
                </p>
                
                <ul className="list-disc pl-6 mb-4 space-y-2">
                  <li>Wake up a sleeping barber if one is available</li>
                  <li>Wait in an empty chair if all barbers are busy but chairs are available</li>
                  <li>Leave if all chairs are occupied</li>
                </ul>
                
                <p className="mb-4">
                  In computing terms, this represents how processes synchronize access to limited resources and how they handle
                  contention when resources are fully utilized.
                </p>
                
                <p className="mb-4 font-medium">Key Synchronization Concepts Illustrated:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <h4 className="font-medium text-blue-800 mb-1">Mutual Exclusion</h4>
                    <p className="text-sm">Ensuring only one process can access a resource at a time (one customer per barber)</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                    <h4 className="font-medium text-green-800 mb-1">Semaphores</h4>
                    <p className="text-sm">Controlling access to resources with limited availability (waiting chairs)</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                    <h4 className="font-medium text-yellow-800 mb-1">Producer-Consumer</h4>
                    <p className="text-sm">Customers (producers) and barbers (consumers) coordinating through a buffer (waiting area)</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <h4 className="font-medium text-purple-800 mb-1">Deadlock Prevention</h4>
                    <p className="text-sm">System design prevents deadlocks where no process can proceed</p>
                  </div>
                </div>
                
                <p className="mb-6">
                  In this interactive simulation, you can experiment with different numbers of barbers, waiting chairs, service times,
                  and customer arrival rates to see how these parameters affect system performance and customer wait times.
                </p>

                <div className="mt-8 mb-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Code className="h-5 w-5 text-purple-600" /> Sleeping Barber Algorithm
                  </h3>
                  
                  <div className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto font-mono text-sm mb-6">
                    <pre className="whitespace-pre-wrap">
{`// Semaphores used in the algorithm
mutex = Semaphore(1)         // Controls access to the waiting chairs
barberReady = Semaphore(0)   // Signals barber is ready to cut hair
customerReady = Semaphore(0) // Signals customer is ready for haircut

// Variables
waitingChairs = [0, 1, ..., N-1]  // N waiting chairs
numberOfWaitingCustomers = 0      // Customers currently waiting`}
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Barber Process */}
                    <div className="rounded-lg border border-purple-200 overflow-hidden">
                      <div className="bg-purple-100 p-3">
                        <h4 className="font-medium text-purple-800">Barber Process</h4>
                      </div>
                      <div className="bg-slate-900 text-slate-50 p-4 font-mono text-sm overflow-x-auto h-full">
                        <pre className="whitespace-pre-wrap">
{`while (true) {
  // If no customers, go to sleep
  if (numberOfWaitingCustomers == 0)
    sleep()  // Implementation: wait for signal
  
  // Acquire mutex to update waiting count
  mutex.acquire()
  numberOfWaitingCustomers--
  
  // Signal that barber is ready
  barberReady.release()
  
  // Wait for customer to be ready
  mutex.release()
  customerReady.acquire()
  
  // Cut hair (outside critical section)
  cutHair()
}`}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Customer Process */}
                    <div className="rounded-lg border border-blue-200 overflow-hidden">
                      <div className="bg-blue-100 p-3">
                        <h4 className="font-medium text-blue-800">Customer Process</h4>
                      </div>
                      <div className="bg-slate-900 text-slate-50 p-4 font-mono text-sm overflow-x-auto h-full">
                        <pre className="whitespace-pre-wrap">
{`// New customer arrives
mutex.acquire()

if (numberOfWaitingCustomers < waitingChairs.length) {
  // Increment waiting count
  numberOfWaitingCustomers++
  
  // Signal that customer is ready
  customerReady.release()
  
  // Release mutex before waiting
  mutex.release()
  
  // Wait for barber to be ready
  barberReady.acquire()
  
  // Get haircut (outside critical section)
  getHairCut()
} else {
  // No chairs available, leave
  mutex.release()
  leaveShop()
}`}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Key Algorithm Components:</h4>
                    <ul className="list-disc pl-6 space-y-2 text-sm">
                      <li><span className="font-bold">Mutex:</span> Ensures only one process can access the waiting chairs count at a time</li>
                      <li><span className="font-bold">Semaphores:</span> barberReady and customerReady coordinate the customer-barber interaction</li>
                      <li><span className="font-bold">Critical Section:</span> The code protected by mutex, where shared resources are accessed</li>
                      <li><span className="font-bold">Bounded Waiting:</span> A customer will only wait if there's an available chair</li>
                      <li><span className="font-bold">Starvation Freedom:</span> If a customer gets a chair, they will eventually get a haircut</li>
                    </ul>
                  </div>
                </div>
                
                <p>
                  This algorithm elegantly solves the producer-consumer problem in operating systems, where barbers are consumers of haircut requests and customers are producers of these requests. The waiting area acts as a bounded buffer.
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
