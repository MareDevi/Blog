---
title: "Rvalue References and Move Semantics in C++"
timestamp: 2025-12-22
description: "In-depth analysis of rvalue references and move semantics introduced in C++11, comparing their performance with traditional copy constructors via benchmarks, and revealing the essence of std::move."
tags:
  - cpp
  - note
toc: true
draft: false
---

Opening with a bold claim: **Move Semantics in C++ is essentially manually triggering an Ownership Transfer in Rust.**

## Why we need it ?

Before C++11, if you wanted to pass an object (like a huge `std::vector` or `std::string`) from one variable to another, or return it from a function, the compiler would typically perform a **Deep Copy**.

- **Copy Constructor:** Allocate new memory -> Copy data -> Destroy old object.
- **Waste:** If the old object is about to be destroyed anyway (e.g., it's a temporary variable), then "copying one and then destroying the original" is very stupid and expensive.
  **Move Semantics** allow us to directly "steal" the resources (like heap memory pointers) of temporary objects instead of copying them.

## Lvalue vs Rvalue

To understand move semantics, we first need to explore the difference between lvalues and rvalues.

- **Lvalue**: - Has a name, has an address, is a persistent object.
  That is to say, we can take the address `&x` of an lvalue.
  For an example: `int a = 10`, where `a` is an lvalue.

- **Rvalue**: - Has no name, has no address, is a dying object (i.e., a temporary object).
  Rvalues are usually literals, results of expression evaluation, or non-reference objects returned by functions.
  For an example: `10`, `x+y`, `func_return_obj()`.

> [!TIP] Tip
> Actually, just like their names, in an assignment statement: `int a = 10`
> The one on the left is the lvalue, and the one on the right is the rvalue.

### Rvalue Reference

In C++11, a new reference type was introduced, the **Rvalue Reference**, denoted by a double `&`.

For example:

```cpp
int& a       // Lvalue reference, can only bind to lvalues
int&& a      // Rvalue reference, can only bind to rvalues
```

```cpp
int a = 10;
int& ref1 = a;  // Legal: lvalue reference binds to lvalue
// int&& ref2 = a; // Illegal! a is an lvalue, cannot bind to rvalue reference

int&& ref3 = 10; // Legal: 10 is an rvalue
```

So what is the use of rvalue references?
An rvalue reference is telling the compiler: "This is a temporary object about to be destroyed. You can modify it at will, or steal its resources. No one will use it anymore anyway."

## Move Semantics

Back to our main topic, what is move semantics?
Move semantics is using **rvalue references** to overload constructors and assignment operators to achieve so-called "resource stealing".

### Example

Suppose we have a class `Buffer` responsible for managing heap memory.

If using the previous copy constructor:

```cpp
// const Buffer& means I don't modify the source object, I only read
Buffer(const Buffer& other) {
    // 1. Allocate new memory
    data = new int[other.size];
    // 2. Copy data (Slow!)
    memcpy(data, other.data, other.size);
    size = other.size;
}
```

And if we use move semantics to implement a move constructor:

```cpp
// Buffer&& means other is a dying value, I can modify it
Buffer(Buffer&& other) noexcept {
    // 1. Directly steal the pointer (Extremely fast!)
    data = other.data;
    size = other.size;

    // 2. Important: Set the source object's pointer to null
    // Otherwise, when other is destructed, it will delete this memory, causing us to dangle (Double Free)
    other.data = nullptr;
    other.size = 0;
}
```

#### Benchmark

You might say: `memcpy` itself is very fast, how much difference can there be between the two?
Then let's write a Benchmark!
Here I directly use a written script, which you can see [here](https://github.com/MareDevi/study_utils/blob/main/copy_vs_move.cpp).
We set the test scenario as: **Transferring a large number of objects from one `vector` to another `vector`**.

To make the comparison pure, I made two key settings:

1.  **Pre-allocate memory (`reserve`)**: Exclude the time for `std::vector` itself to expand and allocate memory, only testing the element construction/copy time.
2.  **Data volume is large enough**: Each object manages **4MB** (1024\*1024 ints) of memory, repeated **1000 times**.

Finally, it ran the following result on my computer:

![benchmark](https://static.maredevi.fun/piclist/20251222175923679.png)

As you can see, using move construction, we are a whole 28.25 times faster than copy construction!

#### Why faster?

Indeed, `memcpy` is fast, but no matter how fast a Ferrari is, it can't beat teleportation.
Broken down, there are mainly three factors:

##### Algorithm Complexity (O(N) vs O(1))

This is the most essential difference.

- **Copy (Based on memcpy):** If you have a 1GB `Buffer` object: `memcpy` must read byte by byte from the source address and write to the destination address. The CPU must move **10^9 bytes**. Time is proportional to data volume (Linear relationship, **O(N)**).
- **Move (Based on pointer swap):** Whether your `Buffer` is 1KB or 100GB, the move constructor only does one thing: **assign pointers**. On a 64-bit system, a pointer is 8 bytes. Time is constant, almost instantaneous (**O(1)**).

Let's use a metaphor:

- **Copy (`memcpy`)**: You have a house full of books. You want to move. You pack every book, transport it to the new house, and unpack it. Although you move fast (SIMD), the more books there are, the more tired you get.
- **Move**: You directly swap the key of the new house for the key of the old house. You don't have to move the books at all; the books are there, only the ownership has changed.

~~This is also the origin of my opening bold claim~~

##### Associated Memory Allocation Cost (System Call)

`memcpy` does not exist in isolation; it is usually followed by a `new`.

```cpp
// Copy Constructor
data = new int[other.size];         // <--- Expensive system call!
memcpy(data, other.data, size);     // <--- Moving data
```

- **Memory Allocation (`malloc`/`new`)**: This is a heavy operation. The operating system needs to find free heap blocks, update the heap table, handle concurrency locks, and even trigger page faults.
- **Move**: No need to allocate new memory, directly take over existing memory blocks.

> [!TIP] Tip
> For small objects, the overhead of `new` might even be greater than `memcpy`.

##### Cache Locality

- **Copy**: `memcpy` involves a lot of memory writes. When you write to a brand new large chunk of memory (just `new`ed), this memory is likely not in the CPU's L1/L2 cache. This causes massive **Cache Misses**, forcing the CPU to wait for the memory bus, causing pipeline stalls.
- **Move**: Only modifying a few pointer variables on the stack. These variables are very likely already in the L1 cache or registers.

### Summary

To put it bluntly, it's not that `memcpy` sucks, but that deep copy itself is an extremely expensive operation.

**Comparison:** Copying is "building an exact same house"; Moving is "giving you the key to the house, and I leave".

## What exactly does `std::move` do?

This is the most easily misunderstood place. **`std::move` doesn't move anything at all.**

It is just a **Cast**. It forcibly casts an lvalue to an rvalue reference (`T&&`).

- **Function:** It means telling the compiler: "Although `x` is an lvalue (has a name), I assure you that I won't use it anymore. You can treat it as an rvalue (temporary object) and go call its move constructor!"

For example:

```cpp
std::string a = "Hello World";
std::string b = a;            // Calls copy constructor, a is still valid
std::string c = std::move(a); // Calls move constructor, a becomes an empty string (resource stolen by c)

// Accessing a at this point is safe, but it is in an undefined state (usually empty), do not rely on its value anymore.
```
