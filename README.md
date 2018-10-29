# Motivation
The [xstate](https://github.com/davidkpiano/xstate) statecharts library has a few interpreters already available with miscelleanous 
characteristics. However, in order to integrate xstate with React through our [`react-state-driven`](https://github.com/brucou/react-state-driven) 
component, we needed to adapt the xstate interface to the interface for our `Machine` component. 
We could not reuse the default interpreter and the currently existing interpreters for xstate as 
they do not synchronously return the list of computed actions in response to an input (listeners 
are instead used). Additionally some interpreters also produce effects which in our design is 
forbidden. As a result we created an interpreter which :

- matches the required interface to integrate xstate in React through our `Machine` component
- computes and returns a list of actions in response to an input
- does not produce any effects

# Install
`npm xstate-interpreter`

# Tests
`npm run test`

# API
## `xstateReactInterpreter(Machine, machineConfig, interpreterConfig)`
TODO
### Description
### Semantics
### Contracts
Best don't use assign - this is already taken care of by the interpreter
However it still might work : to test !

### Examples



