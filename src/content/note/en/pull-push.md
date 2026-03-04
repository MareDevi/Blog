---
title: "Pull and Push Patterns"
timestamp: 2025-12-22
description: "In-depth comparison of Pull and Push data flow patterns in computer science, combined with Rust Future and C++20 Coroutine implementation mechanisms, analyzing their similarities, differences, and pros/cons in asynchronous programming."
tags:
  - cpp
  - rust
  - cs
toc: true
draft: false
---

The "Pull" and "Push" models are the two most fundamental architectural patterns regarding **data flow** and **control** in computer science.

Their essential difference lies in: **Who initiates the action of "data transmission"?**

- **Producer:** The party generating data.
- **Consumer:** The party processing data.

## Push Model

**Core Logic:** The producer is active, and the consumer is passive. When the producer generates new data, it immediately "pushes" the data to the consumer. The consumer doesn't know when the data will come and must be ready to receive it at all times.

- **Life Analogy:** SMS on a mobile phone. You don't know when an SMS will come, but once it comes, the phone rings (notifying you to process it).
- **Code Manifestation:** Callback functions, Event Listeners, RxJS (Observable).
- **Pros:**
  - **Low Latency:** Data is delivered as soon as it is generated, with extremely high real-time performance.
  - **Producer Decoupling:** The producer simply sends and doesn't care about the consumer's current state (unless blocking).
- **Cons:**
  - **Easy to Overwhelm Consumer (Backpressure Issue):** If the speed at which the producer generates data (e.g., 1000 items per second) is far faster than the speed at which the consumer processes it (10 items per second), the consumer will be swamped, causing buffer overflow or crash.
  - **Complex Control Flow:** When debugging, the stack is often hard to trace (Callback Hell).

## Pull Model

**Core Logic:** The consumer is active, and the producer is passive. The consumer actively "requests" data from the producer according to its own processing capability. If the consumer doesn't request, the producer pauses or temporarily stores the data.

- **Life Analogy:** Buffet. You (the consumer) decide when to take a plate to get food, and go get the next plate after finishing eating. The kitchen (producer) is only responsible for cooking the food and putting it there.
- **Code Manifestation:** Iterators (Iterator/Generator), Rust's `Future`, traditional HTTP requests.

- **Pros:**
  - **Natural Backpressure Support:** The consumer completely controls the rate. When it can't handle it, it just stops "pulling", and the system won't crash.
  - **Easy to Compose:** Can easily implement logic like "take the first 5", "filter", etc. (e.g., Rust's `Iterator` adapters).
- **Cons:**
  - **Potential Latency:** Even if data is ready, if the consumer doesn't come to pull, the data won't be processed.
  - **Busy Waiting:** If the consumer constantly keeps pulling (Polling) via an "infinite loop", it wastes CPU by spinning.

## Async Comparison: Rust vs C++

### Rust: Based on Pull

In Rust, `Future` is essentially just a data structure of a **State Machine**.

- **Laziness:** When you create a `Future` (e.g., calling an `async` function), **nothing happens**. Not a single line of code executes. It just generates a struct describing "what I want to do".
- **Poll Mechanism:** Only when you hand this `Future` to an **Executor** (like `tokio` or `async-std`), or `.await` it in another `async` block, will the executor call its `poll()` method.
- **Workflow:**
  1.  The executor calls `future.poll()`.
  2.  The Future attempts to run. If it encounters blocking (e.g., waiting for socket data), it registers a `Waker` (waker) to the OS/Reactor, and then returns `Poll::Pending` (I'm not ready yet).
  3.  The executor receives `Pending` and goes to process other tasks (i.e., the CPU doesn't wait at this time).
  4.  **Key Point:** When data arrives, the OS notifies the Reactor, and the Reactor calls the previously registered `Waker.wake()`.
  5.  `wake()` doesn't execute code directly, but tells the executor: "Hey, this task might be ready, go **Poll** it again and see."
  6.  The executor calls `poll()` again. This time the Future returns `Poll::Ready(result)`, and the task is completed.

> [!TIP] Analogy
> You (Executor) are the boss, Future is the employee.
> You must actively ask the employee: "Is the work done??" (Poll).
> If the employee hasn't finished, they will note down your phone number (Waker).
> When external conditions are met (e.g., documents arrived), the employee calls you: "Boss, you can come ask me again."
> Only when you ask again (Poll), will the employee give you the result.
> If you don't ask, the employee sits there forever without moving.

### C++20: Push

Although the C++20 coroutine standard itself provides building mechanisms (`promise_type`, `awaitable`) allowing for various patterns, in mainstream implementations and general understanding, it tends towards **Eager** execution and **Push** resumption.

- **Eager Execution:** In C++, when you call a coroutine function, it usually starts executing immediately until it encounters the first suspension point (`co_await`).
- **Callback/Resume Mechanism:** When a coroutine waits for I/O at `co_await`, it suspends and registers a callback (usually via `std::coroutine_handle`).
- **Workflow:**
  1.  The coroutine runs, initiating an asynchronous operation (like reading a file).
  2.  The underlying I/O library takes over the request, and the coroutine suspends.
  3.  When the OS completes the I/O operation, it triggers the callback.
  4.  **Key Point:** This callback directly calls `handle.resume()`, **Pushing** the coroutine to continue running from where it paused.

> [!TIP] Analogy
> You (main thread) go to a restaurant to order (start coroutine).
> The waiter (underlying runtime) gives you a pager.
> When the food is ready (I/O complete), the pager vibrates, or the waiter even serves the food directly to your table (Resume), pushing you to start eating.
> You don't need to ask the kitchen "is the food ready" every few minutes.

### Comparison

| **Feature**                | **Rust (Pull / Poll)**                                                                                                                                             | **C++ (Push / Callback-style)**                                                                                                                                           |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Startup Mode**           | **Lazy**. Calling the function only returns a Future; must `.await` or `spawn` to run.                                                                             | **Eager**. Calling the function usually starts execution immediately until the first `co_await`.                                                                          |
| **State Machine Location** | **Inline/Stack (Usually)**. The compiler-generated state machine is a struct that can be nested in other Futures, ultimately compiling into one big state machine. | **Heap Allocation**. Coroutines usually need to allocate heap memory to store coroutine frames (Halo optimization can eliminate some allocations).                        |
| **Scheduling Logic**       | **State Machine Driven**. Executor repeatedly calls `poll`. Must explicitly advance state.                                                                         | **Event Driven**. Completion events directly trigger `resume`.                                                                                                            |
| **Cancellation**           | **Extremely Simple**. Directly `Drop` the Future. Since you don't `poll` it, it stops working.                                                                     | **Very Difficult**. Because the coroutine might already be running or held by a callback chain, an explicit `CancellationToken` mechanism is needed to notify it to stop. |
| **Memory Overhead**        | **Extremely Low**. Because there is no need to allocate independent heap space for each waiting task (Zero-cost abstractions).                                     | **Higher**. Each concurrent task usually needs an independent heap-allocated frame (unless the compiler can aggressively optimize).                                       |
