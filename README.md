💈 Sleeping Barber Problem – Operating Systems Concept
The Sleeping Barber Problem is a classic example of a synchronization problem in operating systems. It illustrates how to manage process synchronization using semaphores or monitors, especially when multiple processes (customers) compete for limited resources (barber and chairs).

💡 Scenario:
A barber shop has one barber, one barber chair, and a waiting room with a limited number of chairs.

If there are no customers, the barber goes to sleep.

When a customer arrives:

If the barber is sleeping, the customer wakes him up.

If the barber is busy and there are empty chairs, the customer waits.

If no chairs are available, the customer leaves.

The barber works on one customer at a time.

🎯 Key Concepts:
Demonstrates the use of semaphores, mutexes, and inter-process communication.

Prevents race conditions, deadlocks, and ensures fair resource allocation.
