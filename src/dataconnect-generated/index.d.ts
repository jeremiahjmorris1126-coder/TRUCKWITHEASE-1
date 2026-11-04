import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Fleet_Key {
  id: string;
  __typename?: 'Fleet_Key';
}

export interface FreightLoad_Key {
  id: UUIDString;
  __typename?: 'FreightLoad_Key';
}

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

export interface GetMyLoadByIdVariables {
  id: UUIDString;
}

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

export interface UpdateMyLoadStatusData {
  freightLoad_update?: FreightLoad_Key | null;
}

export interface UpdateMyLoadStatusVariables {
  id: UUIDString;
  status: string;
}

export interface UpdateMyVehicleSpecsData {
  vehicle_update?: Vehicle_Key | null;
}

export interface UpdateMyVehicleSpecsVariables {
  id: UUIDString;
  heightFeet?: number | null;
  weightLbs?: number | null;
  hazmatClass?: string | null;
}

export interface UpsertMyProfileData {
  user_upsert: User_Key;
}

export interface UpsertMyProfileVariables {
  email: string;
  displayName?: string | null;
}

export interface User_Key {
  uid: string;
  __typename?: 'User_Key';
}

export interface Vehicle_Key {
  id: UUIDString;
  __typename?: 'Vehicle_Key';
}

interface UpsertMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertMyProfileVariables): MutationRef<UpsertMyProfileData, UpsertMyProfileVariables>;
  operationName: string;
}
export const upsertMyProfileRef: UpsertMyProfileRef;

export function upsertMyProfile(vars: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;
export function upsertMyProfile(dc: DataConnect, vars: UpsertMyProfileVariables): MutationPromise<UpsertMyProfileData, UpsertMyProfileVariables>;

interface UpdateMyLoadStatusRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyLoadStatusVariables): MutationRef<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMyLoadStatusVariables): MutationRef<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;
  operationName: string;
}
export const updateMyLoadStatusRef: UpdateMyLoadStatusRef;

export function updateMyLoadStatus(vars: UpdateMyLoadStatusVariables): MutationPromise<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;
export function updateMyLoadStatus(dc: DataConnect, vars: UpdateMyLoadStatusVariables): MutationPromise<UpdateMyLoadStatusData, UpdateMyLoadStatusVariables>;

interface UpdateMyVehicleSpecsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMyVehicleSpecsVariables): MutationRef<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMyVehicleSpecsVariables): MutationRef<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;
  operationName: string;
}
export const updateMyVehicleSpecsRef: UpdateMyVehicleSpecsRef;

export function updateMyVehicleSpecs(vars: UpdateMyVehicleSpecsVariables): MutationPromise<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;
export function updateMyVehicleSpecs(dc: DataConnect, vars: UpdateMyVehicleSpecsVariables): MutationPromise<UpdateMyVehicleSpecsData, UpdateMyVehicleSpecsVariables>;

interface GetMyProfileRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyProfileData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyProfileData, undefined>;
  operationName: string;
}
export const getMyProfileRef: GetMyProfileRef;

export function getMyProfile(options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;
export function getMyProfile(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyProfileData, undefined>;

interface ListMyAssignedVehiclesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyAssignedVehiclesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyAssignedVehiclesData, undefined>;
  operationName: string;
}
export const listMyAssignedVehiclesRef: ListMyAssignedVehiclesRef;

export function listMyAssignedVehicles(options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedVehiclesData, undefined>;
export function listMyAssignedVehicles(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedVehiclesData, undefined>;

interface ListMyAssignedLoadsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyAssignedLoadsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyAssignedLoadsData, undefined>;
  operationName: string;
}
export const listMyAssignedLoadsRef: ListMyAssignedLoadsRef;

export function listMyAssignedLoads(options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedLoadsData, undefined>;
export function listMyAssignedLoads(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyAssignedLoadsData, undefined>;

interface GetMyLoadByIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetMyLoadByIdVariables): QueryRef<GetMyLoadByIdData, GetMyLoadByIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetMyLoadByIdVariables): QueryRef<GetMyLoadByIdData, GetMyLoadByIdVariables>;
  operationName: string;
}
export const getMyLoadByIdRef: GetMyLoadByIdRef;

export function getMyLoadById(vars: GetMyLoadByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyLoadByIdData, GetMyLoadByIdVariables>;
export function getMyLoadById(dc: DataConnect, vars: GetMyLoadByIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetMyLoadByIdData, GetMyLoadByIdVariables>;

