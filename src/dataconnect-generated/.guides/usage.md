# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { upsertMyProfile, updateMyLoadStatus, updateMyVehicleSpecs, getMyProfile, listMyAssignedVehicles, listMyAssignedLoads, getMyLoadById } from '@dataconnect/generated';


// Operation UpsertMyProfile:  For variables, look at type UpsertMyProfileVars in ../index.d.ts
const { data } = await UpsertMyProfile(dataConnect, upsertMyProfileVars);

// Operation UpdateMyLoadStatus:  For variables, look at type UpdateMyLoadStatusVars in ../index.d.ts
const { data } = await UpdateMyLoadStatus(dataConnect, updateMyLoadStatusVars);

// Operation UpdateMyVehicleSpecs:  For variables, look at type UpdateMyVehicleSpecsVars in ../index.d.ts
const { data } = await UpdateMyVehicleSpecs(dataConnect, updateMyVehicleSpecsVars);

// Operation GetMyProfile: 
const { data } = await GetMyProfile(dataConnect);

// Operation ListMyAssignedVehicles: 
const { data } = await ListMyAssignedVehicles(dataConnect);

// Operation ListMyAssignedLoads: 
const { data } = await ListMyAssignedLoads(dataConnect);

// Operation GetMyLoadById:  For variables, look at type GetMyLoadByIdVars in ../index.d.ts
const { data } = await GetMyLoadById(dataConnect, getMyLoadByIdVars);


```