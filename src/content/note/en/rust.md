---
title: "Iterators in Rust"
timestamp: 2026-01-06
description: "Comprehensive introduction to the Iterator design pattern in Rust. From the core Lazy characteristic to common adapters and consumers, to advanced usage like Peekable, scan, fold, and parallel iterators with Rayon."
tags:
  - rust
  - cs
toc: true
draft: false
---

## What is an Iterator?

In Rust, an iterator is a type that implements the `Iterator` trait. Its core task is to generate items in a sequence **on demand**.

**Key Characteristic: Lazy** is the most important feature of Rust iterators. When creating an iterator (e.g., calling `.iter()`) or chaining functions (e.g., `.map()`), **actually nothing happens**. Only when you call a "consumer" method (like `.collect()` or use in a `for` loop) does the iterator truly start working.

Simply put, implementing the `Iterator` trait requires only one method:

```rust
pub trait Iterator {
    type Item;

    fn next(&mut self) -> Option<Self::Item>;
}
```

![](https://static.maredevi.fun/piclist/20260106210858679.png)

### Three Forms of Iterators

Due to the existence of the ownership system in Rust, iterators also come in three forms:

| Method        | Gets Type | Explanation                        | Scenario                                                                         |
| :------------ | :-------- | :--------------------------------- | :------------------------------------------------------------------------------- |
| `iter()`      | `&T`      | Borrow (Read-only reference)       | Want to read data, but not change it, nor hand over ownership.                   |
| `iter_mut()`  | `&mut T`  | Mutable borrow (Mutable reference) | Want to modify data in the collection during traversal.                          |
| `into_iter()` | `T`       | Take ownership (Value)             | After traversal, the original collection is "consumed" and cannot be used again. |

## Consumers and Adapters

Using iterators is like building an assembly line, and methods are divided into two categories: **Adapters** and **Consumers**.

### Adapters - Lazy Transformers

These methods take an iterator and return a new iterator. They don't execute immediately! Just like writing `cat file | grep text` in Shell, if you don't press Enter (i.e., no consumer), nothing happens.

For example:

- `map()`: Transforms each element.
- `filter()`: Filters elements.
- `take(n)`: Takes only the first n elements.
- `zip()`: "Zips" two iterators together.
- `enumerate()`: Adds an index to elements `(index, item)`.

### Consumers - Trigger Execution

These methods call `next()`, drive the iterator execution, and produce the final result.

For example:

- `collect()`: Collects results back into a collection (like `Vec` or `HashMap`).
- `sum()`, `product()`: Mathematical operations.
- `find()`: Finds an element meeting the condition.
- `for` loop: Essentially also a consumer.

### Tip

After reading the above, you should understand that if no consumer is added after the adapter, the entire iterator will actually never be executed (of course, you will get a corresponding warning when trying to compile).

This is the core Lazy Evaluation characteristic of Rust iterators.
You can imagine adapters (Adapters, like `map`, `filter`) as laying water pipes, and consumers (Consumers, like `collect`, `for`) as turning on the tap.
No matter how complex you connect the pipes (through ten layers of filtering, heating, pressurizing), as long as no one turns on the tap at the end, water simply won't flow into the pipe, and not even the first drop will move.

#### Why are Iterators better than `for` loops?

1.  **Performance**: Rust's compiler (LLVM) is extremely good at optimizing iterators. Chained calls like `filter` and `map` are usually compiled into extremely compact assembly code, often faster than handwritten `for` loops, because the compiler can eliminate bounds checks (Bounds Check Elimination).
2.  **Safety**: Using iterators avoids common "out of bounds errors" or "indexing errors" because you don't need to manually manage index variables at all.
3.  **Readability**: Iterators clearly express "what to do" (Map, Filter, Fold), rather than "how to do it" (maintain index `i`, increment `i`, check `i < len`).

## Some Common Methods

Although Rust's `Iterator` trait provides general methods (like `map`, `filter`), certain functions require additional state or special logic to support. To avoid burdening all iterators, Rust adopts an on-demand enhancement strategy: when you call a specific method, it wraps the base iterator into a more advanced struct, thereby endowing it with new superpowers.

### Peekable

The standard `next()` method is "irreversible"—once you look at it, the data is "consumed" (eaten). But when you call the `peekable()` method, the iterator becomes a `Peekable<T>` type, which has an internal "cache slot" to store the "peeked" data.

For an example:

```rust
fn main() {
    let nums = vec![1, 10, 20];
    // Convert to Peekable iterator
    // Note: We need mut because peek() might try to pull data from the underlying iterator and cache it
    let mut iter = nums.into_iter().peekable();

    // First peek
    if let Some(&n) = iter.peek() {
        println!("Peeked: {}", n); // Output 1
    }
    // Peek again, data is still there!
    println!("Still there: {:?}", iter.peek()); // Some(1)

    // Officially consume
    println!("Ate it: {:?}", iter.next()); // Some(1)

    // Peek next again
    println!("Next is: {:?}", iter.peek()); // Some(10)
}
```

### Enumerate

The `enumerate()` method adds an index to the iterator.

For an example:

```rust
let tasks = vec!["Homework", "Self-study"];
// Becomes (usize, &str)
for (i, task) in tasks.iter().enumerate() {
    println!("{}: {}", i, task);
    // Output:
    // 0: Homework
    // 1: Self-study
}
```

### Rev

`rev()` outputs the iterator in reverse.

> Restriction: Can only be used on iterators that implement `DoubleEndedIterator` (e.g., `Vec` can, but an iterator from a TCP stream cannot, because you cannot foresee the end of the stream).

```rust
let nums = vec![1, 2, 3];
for n in nums.iter().rev() {
    println!("{}", n); // Output 3, 2, 1
}
```

### Cycle

Infinite loop, must be consumed with `take` or `break`.

```rust
let pattern = vec!["A", "B"];
// Output: A, B, A, B, A
for x in pattern.iter().cycle().take(5) {
    print!("{}, ", x);
}
```

### Fuse

Fuse. The standard iterator prescribes: once `next()` returns `None`, subsequent calls should theoretically also return `None`, but Rust does not enforce all implementations to abide by this for performance. `fuse()` forcibly adds a layer of insurance: once the first `None` is encountered, subsequent calls will forever return `None`. Use when you write complex low-level logic and are unsure if the data source is well-behaved.

## Some Advanced Usage?

### 1. Iteration with "Internal State" (`scan` & `fold`)

Ordinary `map` is Stateless; it only cares about the current element. But what if you need to **know the result of the previous element while processing this element**?

#### A. `scan`: Accumulator during iteration

`scan` is like a `map` holding state. It maintains a mutable internal state `state`, which can be modified in each iteration.

```rust
fn main() {
    let a = [1, 2, 3, 4];

    // state initial value is 0
    // Closure accepts: (&mut state, item)
    let running_totals: Vec<i32> = a.iter()
        .scan(0, |state, &x| {
            *state += x; // Modify internal state
            Some(*state) // Return the value you want to generate
            // If None is returned, iteration terminates here (like fuse)
        })
        .collect();

    println!("{:?}", running_totals);
    // Output: [1, 3, 6, 10] (i.e. 1, 1+2, 1+2+3...)
}
```

#### B. `fold`: The Ultimate Unification

`collect` is actually a specialization of `fold`. `fold` "folds" everything in the iterator into a single value.

```rust
// Suppose we want to turn a bunch of log lines into a long string
let lines = vec!["Error: A", "Warning: B", "Info: C"];

let report = lines.iter().fold(String::from("Log Report:
"), |mut acc, &line| {
    acc.push_str(" - ");
    acc.push_str(line);
    acc.push_str("
");
    acc
});
// The result is a complete String. This way is much more memory efficient than multiple String + String allocations
```

### 2. Slices (`windows` & `chunks`)

These are actually slice methods, but they return iterators. Extremely useful for processing data streams, signal processing, or text analysis.

#### A. `windows(n)`: Sliding Window

It generates overlapping sub-slices.

```rust
let data = [10, 20, 15, 30, 40];

// Window size is 2, slides one step to the right each time
for slice in data.windows(2) {
    println!("Prev: {}, Curr: {}", slice[0], slice[1]);
}
// Output:
// Prev: 10, Curr: 20
// Prev: 20, Curr: 15 ...
```

#### B. `chunks(n)`: Batch Processing

Non-overlapping chunks.

### 3. `by_ref`: Borrow briefly, don't take away

This is a very subtle but extremely important advanced trick.
When calling methods like `take()`, `collect()` on an iterator, it usually **consumes** the ownership of this iterator variable. What if you only want to **consume a part**, and then continue using the same iterator?

```rust
fn main() {
    let mut lines = vec!["Header1", "Header2", "---", "Body1", "Body2"].into_iter();

    // 1. Read header until "---"
    // Key point: Use by_ref()!
    // If by_ref() is not used, take_while will take ownership of lines, and it cannot be used below
    let headers: Vec<_> = lines.by_ref()
        .take_while(|line| *line != "---")
        .collect();

    println!("Headers: {:?}", headers);

    // 2. Continue using the same lines iterator to read the remaining Body
    println!("Body start:");
    for line in lines {
        println!("{}", line); // Output Body1, Body2
    }
}
```

### 4. `iter::from_fn`: Create iterator out of thin air

You don't need to write a new `struct` and implement `Iterator trait` just to create a simple custom iterator. You can directly build one with a closure.

```rust
use std::iter;

fn main() {
    let mut count = 0;

    // Create an iterator that keeps running as long as next returns Some
    let counter = iter::from_fn(move || {
        count += 1;
        if count < 5 {
            Some(count)
        } else {
            None
        }
    });

    for num in counter {
        println!("{}", num);
    }
}
```

### 5. Parallel Iterators (`Rayon`)

Although this belongs to a third-party library (`rayon`), it is almost an indispensable part of the Rust iterator ecosystem.

If you have an iterator chain processing a large amount of data (like processing millions of logs), you only need to modify two lines of code to let it automatically utilize all CPU cores for parallel processing.

```rust
// Cargo.toml: rayon = "1.8"
use rayon::prelude::*; // Import parallel features

fn main() {
    let numbers: Vec<i64> = (0..1_000_000).collect();

    let sum: i64 = numbers
        .par_iter() // Note: iter() is replaced by par_iter() here
        .map(|&x| x * 2) // This map will execute in parallel on multiple threads
        .sum();

    println!("{}", sum);
}
```

> [!TIP] Benefits
>
> You don't need to write any thread creation, locking, or message passing code. Rust's ownership system guarantees that this parallelism is absolutely data-safe.
