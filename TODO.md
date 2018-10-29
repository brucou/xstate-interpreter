- think about the init event problem : we don't need it for xstate, so should we remove from 
xstate-driven ? or just add a hack which is that if [INIT_EVENT] then bail out? not very nice
- finish tests
- check action type assign works as well
- will be interesting to se how it goes for parallel machines. If it works that it a clear 
advantage for xstate vs. state-transducer
