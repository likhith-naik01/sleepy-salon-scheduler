import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, User, Users, Scissors, Play, Pause, Bell, BellRing, Sparkles } from "lucide-react";
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
  
  // Background particles
  const particlesRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  
  // Metrics - Fixed average wait time calculation
  const averageWaitTime = React.useMemo(() => {
    if (servedCustomers.length === 0) return 0;
    
    // Calculate wait time for each served customer (from arrival to when they started getting served)
    const totalWaitTime = servedCustomers.reduce((total, customer) => {
      // Calculate the waiting time (time from arrival until they were assigned to a barber)
      const waitTime = (customer.timeServed || customer.timeArrived) - customer.timeArrived;
      return total + waitTime;
    }, 0);
    
    // Round to 1 decimal place for display
    return Math.round((totalWaitTime / servedCustomers.length) * 10) / 10;
  }, [servedCustomers]);
  
  // Initialize simulation
  useEffect(() => {
    initializeSimulation();
    createParticles();
    createStars();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  const createParticles = () => {
    if (!particlesRef.current) return;
    
    const particlesContainer = particlesRef.current;
    particlesContainer.innerHTML = '';
    
    // Create floating particles
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'absolute bg-white bg-opacity-20 rounded-full pointer-events-none';
      
      // Random size
      const size = Math.random() * 12 + 3;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      // Random position
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      
      // Random animation duration
      const duration = Math.random() * 20 + 10;
      particle.style.animation = `float ${duration}s linear infinite`;
      
      // Random delay
      particle.style.animationDelay = `-${Math.random() * duration}s`;
      
      particlesContainer.appendChild(particle);
    }
  };
  
  const createStars = () => {
    if (!starsRef.current) return;
    
    const starsContainer = starsRef.current;
    starsContainer.innerHTML = '';
    
    // Create twinkling stars
    for (let i = 0; i < 100; i++) {
      const star = document.createElement('div');
      
      // Random size for stars
      const size = Math.random() * 3 + 1;
      const opacity = Math.random() * 0.7 + 0.3;
      
      star.className = 'absolute rounded-full pointer-events-none';
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.backgroundColor = `rgba(255, 255, 255, ${opacity})`;
      star.style.boxShadow = `0 0 ${size + 2}px rgba(255, 255, 255, 0.8)`;
      
      // Random position
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      
      // Twinkling animation
      const duration = Math.random() * 4 + 2;
      star.style.animation = `twinkle ${duration}s ease-in-out infinite`;
      star.style.animationDelay = `-${Math.random() * duration}s`;
      
      starsContainer.appendChild(star);
    }
  };
  
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
      updatedCurrentCustomers.push(updatedNextCustomer);
      
      // Remove next customer from waiting list
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
        description: `${finishedCustomer.name} finished haircut. ${nextCustomer.name} is now with Barber #${barberId + 1}.`
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
        description: `${customer.name} finished their haircut. Barber #${barberId + 1} is now sleeping as there are no more customers.`
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
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-indigo-900 to-blue-900 p-0 overflow-hidden">
      {/* Animated background */}
      <div 
        ref={particlesRef}
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      />
      <div 
        ref={starsRef}
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      />
      
      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        <header className="mb-8 text-center relative">
          <div className="absolute right-4 top-0">
            <div className="relative">
              {notificationCount > 0 && (
                <div className="absolute -right-1 -top-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white animate-pulse">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                </div>
              )}
              <BellRing className={`h-6 w-6 ${notificationCount > 0 ? 'text-red-300 animate-pulse' : 'text-gray-300'}`} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 mb-2 animate-bounce-slow">
            Sleeping Barber
          </h1>
          <div className="inline-block relative">
            <Sparkles className="absolute -left-8 -top-6 h-5 w-5 text-yellow-300 animate-spin-slow" />
            <Sparkles className="absolute -right-8 -top-4 h-4 w-4 text-blue-300 animate-spin-slow-reverse" />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left panel - Controls */}
          <div className="lg:col-span-1 space-y-6 animate-fade-in">
            {/* Controls Panel */}
            <Card className="border border-purple-500/20 bg-black/50 backdrop-blur-lg text-white overflow-hidden hover:shadow-glow-purple transition-all duration-500">
              <CardHeader className="border-b border-purple-500/20 bg-purple-900/40">
                <CardTitle className="flex items-center gap-2 text-purple-100">
                  <Clock className="h-5 w-5 text-purple-200" />
                  Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="numBarbers" className="text-sm text-purple-200 mb-1 block">Barbers: {numBarbers}</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateBarberCount(numBarbers - 1)}
                          disabled={numBarbers <= 1}
                          className="bg-purple-900/50 border-purple-500/30 hover:bg-purple-800/80 text-purple-100 h-8 w-8 p-0"
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
                          className="flex-1"
                        />
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => updateBarberCount(numBarbers + 1)}
                          disabled={numBarbers >= 5}
                          className="bg-purple-900/50 border-purple-500/30 hover:bg-purple-800/80 text-purple-100 h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="numChairs" className="text-sm text-purple-200 mb-1 block">Waiting Chairs: {numChairs}</Label>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => updateChairCount(numChairs - 1)}
                          disabled={numChairs <= 1}
                          className="bg-purple-900/50 border-purple-500/30 hover:bg-purple-800/80 text-purple-100 h-8 w-8 p-0"
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
                          className="flex-1"
                        />
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => updateChairCount(numChairs + 1)}
                          disabled={numChairs >= 10}
                          className="bg-purple-900/50 border-purple-500/30 hover:bg-purple-800/80 text-purple-100 h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="serviceTime" className="text-sm text-purple-200 mb-1 block">Service Time: {serviceTime}s</Label>
                      <Slider
                        id="serviceTime"
                        min={5}
                        max={30}
                        step={1}
                        value={[serviceTime]}
                        onValueChange={(values) => setServiceTime(values[0])}
                        className="flex-1"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="arrivalRate" className="text-sm text-purple-200 mb-1 block">Arrival Rate: {arrivalRate}/min</Label>
                      <Slider
                        id="arrivalRate"
                        min={1}
                        max={12}
                        step={1}
                        value={[arrivalRate]}
                        onValueChange={(values) => setArrivalRate(values[0])}
                        className="flex-1"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="simulationSpeed" className="text-sm text-purple-200 mb-1 block">Speed: {simulationSpeed}x</Label>
                      <Slider
                        id="simulationSpeed"
                        min={0.5}
                        max={5}
                        step={0.5}
                        value={[simulationSpeed]}
                        onValueChange={(values) => setSimulationSpeed(values[0])}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  
                  {/* Quick add customer */}
                  <form onSubmit={handleBooking} className="flex items-center gap-2">
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                      className="bg-purple-900/40 border-purple-500/30 text-purple-100 placeholder:text-purple-300/50 flex-1"
                    />
                    <Button 
                      type="submit" 
                      className="bg-pink-600 hover:bg-pink-700 text-white"
                    >
                      Add
                    </Button>
                  </form>
                </div>
              </CardContent>
              <CardFooter className="border-t border-purple-500/20 flex justify-between pt-4 pb-4 bg-purple-900/20">
                <Button 
                  variant="outline" 
                  onClick={resetSimulation}
                  className="bg-purple-900/50 border-purple-500/30 hover:bg-purple-800/80 text-purple-100 hover:scale-105 transition-transform duration-300"
                >
                  Reset
                </Button>
                {isRunning && !isPaused ? (
                  <Button 
                    variant="secondary" 
                    onClick={togglePauseSimulation}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white hover:scale-105 transition-transform duration-300"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                ) : (
                  <Button 
                    variant="default" 
                    onClick={startHaircuts} 
                    className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:scale-105 transition-transform duration-300"
                  >
                    <Play className="h-4 w-4" />
                    {isPaused ? "Resume" : "Start"}
                  </Button>
                )}
              </CardFooter>
            </Card>
            
            {/* Stats */}
            <Card className="border border-blue-500/20 bg-black/40 backdrop-blur-lg text-white hover:shadow-glow-blue transition-all duration-500">
              <CardHeader className="border-b border-blue-500/20 bg-blue-900/40">
                <CardTitle className="flex items-center gap-2 text-blue-100">
                  <Users className="h-5 w-5 text-blue-200" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 p-4 rounded-xl border border-green-500/20 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-green-300">{servedCustomers.length}</div>
                    <div className="text-xs text-green-200 text-center">Served</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 p-4 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-blue-300">{waitingCustomers.length}</div>
                    <div className="text-xs text-blue-200 text-center">Waiting</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 p-4 rounded-xl border border-red-500/20 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-red-300">{turnedAwayCustomers.length}</div>
                    <div className="text-xs text-red-200 text-center">Turned Away</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 p-4 rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-yellow-300">{averageWaitTime.toFixed(1)}s</div>
                    <div className="text-xs text-yellow-200 text-center">Avg Wait</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Right panel - Main visualization */}
          <div className="lg:col-span-3 space-y-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {/* Barber Stations */}
            <Card className="border border-indigo-500/20 bg-black/50 backdrop-blur-lg text-white overflow-hidden hover:shadow-glow-indigo transition-all duration-500">
              <CardHeader className="border-b border-indigo-500/20 bg-indigo-900/40">
                <CardTitle className="flex items-center gap-2 text-indigo-100">
                  <Scissors className="h-5 w-5 text-indigo-200" />
                  Barber Stations
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="barber-shop-floor grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
                  {barbers.map((barber, index) => {
                    const customer = getCustomerById(barber.servingCustomerId);
                    const serviceProgress = getServiceProgress(barber);
                    const timeRemaining = getTimeRemaining(barber);
                    const isActive = lastActiveBarber === index;
                    
                    return (
                      <div 
                        key={barber.id} 
                        className={`relative transition-all duration-500 animate-fade-in`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div 
                          className={`barber p-6 rounded-xl border shadow-lg transition-all duration-300 hover:scale-105 ${
                            barber.state === BarberState.SLEEPING 
                              ? 'bg-gradient-to-br from-gray-900/80 to-gray-800/60 border-gray-500/30' 
                              : isActive 
                                ? 'bg-gradient-to-br from-green-900/80 to-green-800/60 border-green-500/50 animate-pulse shadow-green-500/20' 
                                : 'bg-gradient-to-br from-green-900/60 to-green-800/40 border-green-500/30'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-3">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                              barber.state === BarberState.SLEEPING 
                                ? 'bg-gray-700/60'
                                : 'bg-green-700/60'
                            }`}>
                              <Scissors 
                                className={`w-8 h-8 transition-all duration-300 ${
                                  barber.state === BarberState.SLEEPING 
                                    ? 'text-gray-400' 
                                    : isActive 
                                      ? 'text-green-300 animate-[spin_3s_linear_infinite]' 
                                      : 'text-green-300'
                                }`} 
                              />
                            </div>
                            <div className="mt-2 text-center font-medium">
                              <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                                Barber #{barber.id}
                              </span>
                            </div>
                            <div 
                              className={`px-3 py-1 rounded-full text-xs text-center font-medium ${
                                barber.state === BarberState.SLEEPING 
                                  ? 'bg-gray-700/50 text-gray-300' 
                                  : 'bg-green-700/50 text-green-300'
                              }`}
                            >
                              {barber.state === BarberState.SLEEPING ? 'Sleeping' : 'Working'}
                            </div>
                            
                            {barber.state === BarberState.WORKING && customer && (
                              <div className="mt-2 w-full">
                                <div className="rounded-lg bg-indigo-900/30 border border-indigo-500/20 p-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-sm font-medium text-indigo-300">{customer.name}</div>
                                    <div className="text-xs font-bold text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded-full">
                                      {timeRemaining.toFixed(1)}s
                                    </div>
                                  </div>
                                  <Progress 
                                    value={serviceProgress} 
                                    className="h-3 bg-indigo-900/50"
                                    onComplete={() => handleServiceComplete(barber.id)}
                                    duration={timeRemaining}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {barber.servingCustomerId && (
                          <div className="absolute -right-4 -top-4 animate-bounce-gentle">
                            <div 
                              className={`${
                                lastServedCustomer === barber.servingCustomerId 
                                  ? 'bg-blue-500 animate-pulse' 
                                  : 'bg-blue-700'
                              } text-white p-2 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30`}
                            >
                              <User className="w-4 h-4" />
                            </div>
                          </div>
                        )}
                        
                        {/* Served counter badge */}
                        <div className="absolute -left-2 -top-2">
                          <div className="bg-purple-700/80 text-white p-1 px-2 rounded-full text-xs shadow-lg">
                            {barber.totalCustomersServed} ✓
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {barbers.length === 0 && (
                    <div className="col-span-full text-center py-12 text-gray-400">
                      No barbers available. Press "Start" to initialize the simulation.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Waiting Area & Recent Haircuts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Waiting Area */}
              <Card className="border border-amber-500/20 bg-black/50 backdrop-blur-lg text-white hover:shadow-glow-amber transition-all duration-500 animate-fade-in" style={{ animationDelay: "0.3s" }}>
                <CardHeader className="border-b border-amber-500/20 bg-amber-900/40">
                  <CardTitle className="flex items-center justify-between text-amber-100">
                    <span className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-200" />
                      Waiting Area ({waitingCustomers.length}/{numChairs})
                    </span>
                    {waitingCustomers.length > 0 && (
                      <span className="text-xs bg-amber-600/50 text-amber-200 px-2 py-1 rounded-full">
                        Customers Waiting
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="waiting-area max-h-[300px] overflow-y-auto bg-amber-950/20 p-3">
                    {waitingCustomers.map((customer, index) => {
                      const waitingTime = currentTime - customer.timeArrived;
                      let urgencyColor = 'bg-blue-900/50 text-blue-300 border-blue-500/30';
                      if (waitingTime > 30) urgencyColor = 'bg-red-900/50 text-red-300 border-red-500/30';
                      else if (waitingTime > 15) urgencyColor = 'bg-amber-900/50 text-amber-300 border-amber-500/30';
                      
                      return (
                        <div 
                          key={customer.id} 
                          className="relative mb-3 overflow-hidden animate-fade-in"
                          style={{animationDelay: `${index * 0.1}s`}}
                        >
                          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-950/40 to-amber-900/20 rounded-lg border border-amber-500/20 shadow-lg hover:border-amber-500/50 transition-colors duration-300 hover:translate-x-1 transform">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-white shadow-lg animate-pulse-slow">
                              <User className="w-5 h-5" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="text-sm font-medium text-amber-200">{customer.name}</div>
                              <div className="flex justify-between items-center">
                                <div className="text-xs text-amber-400/70">Position: {index + 1}</div>
                                <div className={`text-xs px-2 py-0.5 rounded-full border ${urgencyColor}`}>
                                  {formatTime(waitingTime)}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Position indicator */}
                          <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-600 border-2 border-amber-400 flex items-center justify-center text-[10px] font-bold text-white">
                            {index + 1}
                          </div>
                        </div>
                      );
                    })}
                    
                    {waitingCustomers.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No customers waiting
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Recent Haircuts */}
              <Card className="border border-green-500/20 bg-black/50 backdrop-blur-lg text-white hover:shadow-glow-green transition-all duration-500 animate-fade-in" style={{ animationDelay: "0.4s" }}>
                <CardHeader className="border-b border-green-500/20 bg-green-900/40">
                  <CardTitle className="flex items-center gap-2 text-green-100">
                    <Scissors className="h-5 w-5 text-green-200" />
                    Recent Haircuts
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="recent-haircuts max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-green-950/50">
                        <TableRow className="hover:bg-green-900/30 border-b border-green-500/20">
                          <TableHead className="text-green-300">Customer</TableHead>
                          <TableHead className="text-green-300">Barber</TableHead>
                          <TableHead className="text-green-300 text-right">Wait</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servedCustomers.slice(-5).reverse().map((customer, idx) => (
                          <TableRow 
                            key={customer.id} 
                            className="hover:bg-green-800/20 border-b border-green-500/10 animate-fade-in hover:translate-x-1 transition-transform duration-300"
                            style={{animationDelay: `${idx * 0.1}s`}}
                          >
                            <TableCell className="font-medium text-green-200">{customer.name}</TableCell>
                            <TableCell className="text-green-300">#{customer.servedBy}</TableCell>
                            <TableCell className="text-right text-green-300">{((customer.timeServed || 0) - customer.timeArrived).toFixed(1)}s</TableCell>
                          </TableRow>
                        ))}
                        {servedCustomers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-gray-400">
                              No customers have been served yet
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      
      {/* CSS for animations - fixed the issue by correctly setting style tag */}
      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translateY(0) rotate(0);
            }
            25% {
              transform: translateY(-20px) rotate(5deg);
            }
            50% {
              transform: translateY(10px) rotate(-5deg);
            }
            75% {
              transform: translateY(-5px) rotate(2deg);
            }
          }
          
          @keyframes twinkle {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            50% {
              opacity: 1;
              transform: scale(1.2);
            }
          }
          
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          @keyframes bounce-slow {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          
          @keyframes bounce-gentle {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-4px);
            }
          }
          
          @keyframes pulse-slow {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.6;
            }
          }
          
          @keyframes spin-slow {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          
          @keyframes spin-slow-reverse {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(-360deg);
            }
          }
          
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
          
          .animate-bounce-slow {
            animation: bounce-slow 3s ease-in-out infinite;
          }
          
          .animate-bounce-gentle {
            animation: bounce-gentle 2s ease-in-out infinite;
          }
          
          .animate-pulse-slow {
            animation: pulse-slow 3s ease-in-out infinite;
          }
          
          .animate-spin-slow {
            animation: spin-slow 10s linear infinite;
          }
          
          .animate-spin-slow-reverse {
            animation: spin-slow-reverse 8s linear infinite;
          }
          
          .hover\:shadow-glow-purple:hover {
            box-shadow: 0 0 15px rgba(168, 85, 247, 0.5);
          }
          
          .hover\:shadow-glow-blue:hover {
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
          }
          
          .hover\:shadow-glow-indigo:hover {
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
          }
          
          .hover\:shadow-glow-amber:hover {
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.5);
          }
          
          .hover\:shadow-glow-green:hover {
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
          }
        `}
      </style>
    </div>
  );
};

export default Index;
