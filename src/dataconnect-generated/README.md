# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `default`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyProfile*](#getmyprofile)
  - [*ListMyAssignedVehicles*](#listmyassignedvehicles)
  - [*ListMyAssignedLoads*](#listmyassignedloads)
  - [*GetMyLoadById*](#getmyloadbyid)
- [**Mutations**](#mutations)
  - [*UpsertMyProfile*](#upsertmyprofile)
  - [*UpdateMyLoadStatus*](#updatemyloadstatus)
  - [*UpdateMyVehicleSpecs*](#updatemyvehiclespecs)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `default`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyProfile
You can execute the `GetMyProfile` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyProfile(options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;

interface GetMyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyProfileData, undefined>;
}
export const getMyProfileRef: GetMyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;

interface GetMyProfileRef {
  ...
  (dc: DataConnect): QueryRef<GetMyProfileData, undefined>;
}
export const getMyProfileRef: GetMyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyProfileRef:
```typescript
const name = getMyProfileRef.operationName;
console.log(name);
```

### Variables
The `GetMyProfile` query has no variables.
### Return Type
Recall that executing the `GetMyProfile` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyProfileData {
  user?: {
    uid: string;
    email: string;
    displayName?: string | null;
    role: string;
    disabled: boolean;
    createdAt: TimestampString;
    fleet?: {
      id: string;
      carrierName: string;
      usdotNumber?: string | null;
      mcNumber?: string | null;
    } & Fleet_Key;
  } & User_Key;
}
```
### Using `GetMyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyProfile } from '@dataconnect/generated';


// Call the `getMyProfile()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyProfile();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyProfile(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getMyProfile().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetMyProfile`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyProfileRef } from '@dataconnect/generated';


// Call the `getMyProfileRef()` function to get a reference to the query.
const ref = getMyProfileRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyProfileRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListMyAssignedVehicles
You can execute the `ListMyAssignedVehicles` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyAssignedVehicles(options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedVehiclesData, undefined>;

interface ListMyAssignedVehiclesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyAssignedVehiclesData, undefined>;
}
export const listMyAssignedVehiclesRef: ListMyAssignedVehiclesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyAssignedVehicles(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedVehiclesData, undefined>;

interface ListMyAssignedVehiclesRef {
  ...
  (dc: DataConnect): QueryRef<ListMyAssignedVehiclesData, undefined>;
}
export const listMyAssignedVehiclesRef: ListMyAssignedVehiclesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyAssignedVehiclesRef:
```typescript
const name = listMyAssignedVehiclesRef.operationName;
console.log(name);
```

### Variables
The `ListMyAssignedVehicles` query has no variables.
### Return Type
Recall that executing the `ListMyAssignedVehicles` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyAssignedVehiclesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyAssignedVehiclesData {
  vehicles: ({
    id: UUIDString;
    unitNumber: string;
    vin?: string | null;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    heightFeet?: number | null;
    weightLbs?: number | null;
    hazmatClass?: string | null;
    updatedAt: TimestampString;
    fleet: {
      id: string;
      carrierName: string;
    } & Fleet_Key;
  } & Vehicle_Key)[];
}
```
### Using `ListMyAssignedVehicles`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyAssignedVehicles } from '@dataconnect/generated';


// Call the `listMyAssignedVehicles()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyAssignedVehicles();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyAssignedVehicles(dataConnect);

console.log(data.vehicles);

// Or, you can use the `Promise` API.
listMyAssignedVehicles().then((response) => {
  const data = response.data;
  console.log(data.vehicles);
});
```

### Using `ListMyAssignedVehicles`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyAssignedVehiclesRef } from '@dataconnect/generated';


// Call the `listMyAssignedVehiclesRef()` function to get a reference to the query.
const ref = listMyAssignedVehiclesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyAssignedVehiclesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.vehicles);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicles);
});
```

## ListMyAssignedLoads
You can execute the `ListMyAssignedLoads` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyAssignedLoads(options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedLoadsData, undefined>;

interface ListMyAssignedLoadsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyAssignedLoadsData, undefined>;
}
export const listMyAssignedLoadsRef: ListMyAssignedLoadsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyAssignedLoads(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedLoadsData, undefined>;

interface ListMyAssignedLoadsRef {
  ...
  (dc: DataConnect): QueryRef<ListMyAssignedLoadsData, undefined>;
}
export const listMyAssignedLoadsRef: ListMyAssignedLoadsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyAssignedLoadsRef:
```typescript
const name = listMyAssignedLoadsRef.operationName;
console.log(name);
```

### Variables
The `ListMyAssignedLoads` query has no variables.
### Return Type
Recall that executing the `ListMyAssignedLoads` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyAssignedLoadsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMyAssignedLoadsData {
  freightLoads: ({
    id: UUIDString;
    origin: string;
    destination: string;
    rateUsd: number;
    miles: number;
    weightLbs?: number | null;
    equipmentType: string;
    status: string;
    pickupTime?: TimestampString | null;
    deliveryTime?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    fleet: {
      id: string;
      carrierName: string;
    } & Fleet_Key;
  } & FreightLoad_Key)[];
}
```
### Using `ListMyAssignedLoads`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyAssignedLoads } from '@dataconnect/generated';


// Call the `listMyAssignedLoads()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyAssignedLoads();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyAssignedLoads(dataConnect);

console.log(data.freightLoads);

// Or, you can use the `Promise` API.
listMyAssignedLoads().then((response) => {
  const data = response.data;
  console.log(data.freightLoads);
});
```

### Using `ListMyAssignedLoads`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyAssignedLoadsRef } from '@dataconnect/generated';


// Call the `listMyAssignedLoadsRef()` function to get a reference to the query.
const ref = listMyAssignedLoadsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyAssignedLoadsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.freightLoads);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.freightLoads);
});
```

## GetMyLoadById
You can execute the `GetMyLoadById` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyLoadById(vars: GetMyLoadByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyLoadByIdData, GetMyLoadByIdVariables>;

interface GetMyLoadByIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyLoadByIdVariables): QueryRef<GetMyLoadByIdData, GetMyLoadByIdVariables>;
}
export const getMyLoadByIdRef: GetMyLoadByIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyLoadById(dc: DataConnect, vars: GetMyLoadByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyLoadByIdData, GetMyLoadByIdVariables>;

interface GetMyLoadByIdRef {
  ...
  (dc: DataConnect, vars: GetMyLoadByIdVariables): QueryRef<GetMyLoadByIdData, GetMyLoadByIdVariables>;
}
export const getMyLoadByIdRef: GetMyLoadByIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyLoadByIdRef:
```typescript
const name = getMyLoadByIdRef.operationName;
console.log(name);
```

### Variables
The `GetMyLoadById` query requires an argument of type `GetMyLoadByIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetMyLoadByIdVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetMyLoadById` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyLoadByIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyLoadByIdData {
  freightLoad?: {
    id: UUIDString;
    origin: string;
    destination: string;
    rateUsd: number;
    miles: number;
    weightLbs?: number | null;
    equipmentType: string;
    status: string;
    pickupTime?: TimestampString | null;
    deliveryTime?: TimestampString | null;
    createdAt: TimestampString;
    updatedAt: TimestampString;
    fleet: {
      id: string;
      carrierName: string;
      usdotNumber?: string | null;
    } & Fleet_Key;
  } & FreightLoad_Key;
}
```
### Using `GetMyLoadById`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyLoadById, GetMyLoadByIdVariables } from '@dataconnect/generated';

// The `GetMyLoadById` query requires an argument of type `GetMyLoadByIdVariables`:
const getMyLoadByIdVars: GetMyLoadByIdVariables = {
  id: ..., 
};

// Call the `getMyLoadById()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyLoadById(getMyLoadByIdVars);
// Variables can be defined inline as well.
const { data } = await getMyLoadById({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyLoadById(dataConnect, getMyLoadByIdVars);

console.log(data.freightLoad);

// Or, you can use the `Promise` API.
getMyLoadById(getMyLoadByIdVars).then((response) => {
  const data = response.data;
  console.log(data.freightLoad);
});
```

### Using `GetMyLoadById`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyLoadByIdRef, GetMyLoadByIdVariables } from '@dataconnect/generated';

// The `GetMyLoadById` query requires an argument of type `GetMyLoadByIdVariables`:
const getMyLoadByIdVars: GetMyLoadByIdVariables = {
  id: ..., 
};

// Call the `getMyLoadByIdRef()` function to get a reference to the query.
const ref = getMyLoadByIdRef(getMyLoadByIdVars);
// Variables can be defined inline as well.
const ref = getMyLoadByIdRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyLoadByIdRef(dataConnect, getMyLoadByIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.freightLoad);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.freightLoad);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `default` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## UpsertMyProfile
You can execute the `UpsertMyProfile` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertMyProfile(vars: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface UpsertMyProfileRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
}
export const upsertMyProfileRef: UpsertMyProfileRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertMyProfile(dc: DataConnect, vars: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface UpsertMyProfileRef {
  ...
  (dc: DataConnect, vars: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
}
export const upsertMyProfileRef: UpsertMyProfileRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertMyProfileRef:
```typescript
const name = upsertMyProfileRef.operationName;
console.log(name);
```

### Variables
The `UpsertMyProfile` mutation requires an argument of type `UpsertMyProfileVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertMyProfileVariables {
  email: string;
  displayName?: string | null;
}
```
### Return Type
Recall that executing the `UpsertMyProfile` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertMyProfileData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertMyProfileData {
  user_upsert: User_Key;
}
```
### Using `UpsertMyProfile`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertMyProfile, UpsertMyProfileVariables } from '@dataconnect/generated';

// The `UpsertMyProfile` mutation requires an argument of type `UpsertMyProfileVariables`:
const upsertMyProfileVars: UpsertMyProfileVariables = {
  email: ..., 
  displayName: ..., // optional
};

// Call the `upsertMyProfile()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertMyProfile(upsertMyProfileVars);
// Variables can be defined inline as well.
const { data } = await upsertMyProfile({ email: ..., displayName: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertMyProfile(dataConnect, upsertMyProfileVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
upsertMyProfile(upsertMyProfileVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpsertMyProfile`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertMyProfileRef, UpsertMyProfileVariables } from '@dataconnect/generated';

// The `UpsertMyProfile` mutation requires an argument of type `UpsertMyProfileVariables`:
const upsertMyProfileVars: UpsertMyProfileVariables = {
  email: ..., 
  displayName: ..., // optional
};

// Call the `upsertMyProfileRef()` function to get a reference to the mutation.
const ref = upsertMyProfileRef(upsertMyProfileVars);
// Variables can be defined inline as well.
const ref = upsertMyProfileRef({ email: ..., displayName: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertMyProfileRef(dataConnect, upsertMyProfileVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## UpdateMyLoadStatus
You can execute the `UpdateMyLoadStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMyLoadStatus(vars: UpdateMyLoadStatusVariables): MutationPromise<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;

interface UpdateMyLoadStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyLoadStatusVariables): MutationRef<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;
}
export const updateMyLoadStatusRef: UpdateMyLoadStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMyLoadStatus(dc: DataConnect, vars: UpdateMyLoadStatusVariables): MutationPromise<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;

interface UpdateMyLoadStatusRef {
  ...
  (dc: DataConnect, vars: UpdateMyLoadStatusVariables): MutationRef<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;
}
export const updateMyLoadStatusRef: UpdateMyLoadStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMyLoadStatusRef:
```typescript
const name = updateMyLoadStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateMyLoadStatus` mutation requires an argument of type `UpdateMyLoadStatusVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMyLoadStatusVariables {
  id: UUIDString;
  status: string;
}
```
### Return Type
Recall that executing the `UpdateMyLoadStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMyLoadStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMyLoadStatusData {
  freightLoad_update?: FreightLoad_Key | null;
}
```
### Using `UpdateMyLoadStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMyLoadStatus, UpdateMyLoadStatusVariables } from '@dataconnect/generated';

// The `UpdateMyLoadStatus` mutation requires an argument of type `UpdateMyLoadStatusVariables`:
const updateMyLoadStatusVars: UpdateMyLoadStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateMyLoadStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMyLoadStatus(updateMyLoadStatusVars);
// Variables can be defined inline as well.
const { data } = await updateMyLoadStatus({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMyLoadStatus(dataConnect, updateMyLoadStatusVars);

console.log(data.freightLoad_update);

// Or, you can use the `Promise` API.
updateMyLoadStatus(updateMyLoadStatusVars).then((response) => {
  const data = response.data;
  console.log(data.freightLoad_update);
});
```

### Using `UpdateMyLoadStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMyLoadStatusRef, UpdateMyLoadStatusVariables } from '@dataconnect/generated';

// The `UpdateMyLoadStatus` mutation requires an argument of type `UpdateMyLoadStatusVariables`:
const updateMyLoadStatusVars: UpdateMyLoadStatusVariables = {
  id: ..., 
  status: ..., 
};

// Call the `updateMyLoadStatusRef()` function to get a reference to the mutation.
const ref = updateMyLoadStatusRef(updateMyLoadStatusVars);
// Variables can be defined inline as well.
const ref = updateMyLoadStatusRef({ id: ..., status: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMyLoadStatusRef(dataConnect, updateMyLoadStatusVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.freightLoad_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.freightLoad_update);
});
```

## UpdateMyVehicleSpecs
You can execute the `UpdateMyVehicleSpecs` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateMyVehicleSpecs(vars: UpdateMyVehicleSpecsVariables): MutationPromise<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;

interface UpdateMyVehicleSpecsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyVehicleSpecsVariables): MutationRef<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;
}
export const updateMyVehicleSpecsRef: UpdateMyVehicleSpecsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateMyVehicleSpecs(dc: DataConnect, vars: UpdateMyVehicleSpecsVariables): MutationPromise<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;

interface UpdateMyVehicleSpecsRef {
  ...
  (dc: DataConnect, vars: UpdateMyVehicleSpecsVariables): MutationRef<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;
}
export const updateMyVehicleSpecsRef: UpdateMyVehicleSpecsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateMyVehicleSpecsRef:
```typescript
const name = updateMyVehicleSpecsRef.operationName;
console.log(name);
```

### Variables
The `UpdateMyVehicleSpecs` mutation requires an argument of type `UpdateMyVehicleSpecsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateMyVehicleSpecsVariables {
  id: UUIDString;
  heightFeet?: number | null;
  weightLbs?: number | null;
  hazmatClass?: string | null;
}
```
### Return Type
Recall that executing the `UpdateMyVehicleSpecs` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateMyVehicleSpecsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateMyVehicleSpecsData {
  vehicle_update?: Vehicle_Key | null;
}
```
### Using `UpdateMyVehicleSpecs`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateMyVehicleSpecs, UpdateMyVehicleSpecsVariables } from '@dataconnect/generated';

// The `UpdateMyVehicleSpecs` mutation requires an argument of type `UpdateMyVehicleSpecsVariables`:
const updateMyVehicleSpecsVars: UpdateMyVehicleSpecsVariables = {
  id: ..., 
  heightFeet: ..., // optional
  weightLbs: ..., // optional
  hazmatClass: ..., // optional
};

// Call the `updateMyVehicleSpecs()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateMyVehicleSpecs(updateMyVehicleSpecsVars);
// Variables can be defined inline as well.
const { data } = await updateMyVehicleSpecs({ id: ..., heightFeet: ..., weightLbs: ..., hazmatClass: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateMyVehicleSpecs(dataConnect, updateMyVehicleSpecsVars);

console.log(data.vehicle_update);

// Or, you can use the `Promise` API.
updateMyVehicleSpecs(updateMyVehicleSpecsVars).then((response) => {
  const data = response.data;
  console.log(data.vehicle_update);
});
```

### Using `UpdateMyVehicleSpecs`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateMyVehicleSpecsRef, UpdateMyVehicleSpecsVariables } from '@dataconnect/generated';

// The `UpdateMyVehicleSpecs` mutation requires an argument of type `UpdateMyVehicleSpecsVariables`:
const updateMyVehicleSpecsVars: UpdateMyVehicleSpecsVariables = {
  id: ..., 
  heightFeet: ..., // optional
  weightLbs: ..., // optional
  hazmatClass: ..., // optional
};

// Call the `updateMyVehicleSpecsRef()` function to get a reference to the mutation.
const ref = updateMyVehicleSpecsRef(updateMyVehicleSpecsVars);
// Variables can be defined inline as well.
const ref = updateMyVehicleSpecsRef({ id: ..., heightFeet: ..., weightLbs: ..., hazmatClass: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateMyVehicleSpecsRef(dataConnect, updateMyVehicleSpecsVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.vehicle_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.vehicle_update);
});
```

