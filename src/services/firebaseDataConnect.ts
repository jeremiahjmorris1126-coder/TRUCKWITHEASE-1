import { getDataConnect, connectDataConnectEmulator, type DataConnect } from 'firebase/data-connect';
import { clientApp } from './firebaseClientAuth';
import {
  connectorConfig,
  getMyProfile,
  getMyProfileRef,
  listMyAssignedVehicles,
  listMyAssignedVehiclesRef,
  listMyAssignedLoads,
  listMyAssignedLoadsRef,
  getMyLoadById,
  getMyLoadByIdRef,
  upsertMyProfile,
  upsertMyProfileRef,
  updateMyLoadStatus,
  updateMyLoadStatusRef,
  updateMyVehicleSpecs,
  updateMyVehicleSpecsRef,
} from '../dataconnect-generated';

/**
 * Initialized Firebase SQL Connect (Data Connect) client instance
 * connected to project-f0634118-be01-44f7-b36 (truckwithease-service / default connector).
 */
export const dataConnect: DataConnect = getDataConnect(clientApp, connectorConfig);

let dcEmulatorConnected = false;
if (
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  !import.meta.env.PROD &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
  !dcEmulatorConnected
) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_DATACONNECT_EMULATOR_HOST || '127.0.0.1';
  const emulatorPort = Number(import.meta.env.VITE_FIREBASE_DATACONNECT_EMULATOR_PORT) || 9399;
  try {
    connectDataConnectEmulator(dataConnect, emulatorHost, emulatorPort);
    dcEmulatorConnected = true;
  } catch {
    // Ignore if already connected
  }
}

export {
  connectorConfig,
  getMyProfile,
  getMyProfileRef,
  listMyAssignedVehicles,
  listMyAssignedVehiclesRef,
  listMyAssignedLoads,
  listMyAssignedLoadsRef,
  getMyLoadById,
  getMyLoadByIdRef,
  upsertMyProfile,
  upsertMyProfileRef,
  updateMyLoadStatus,
  updateMyLoadStatusRef,
  updateMyVehicleSpecs,
  updateMyVehicleSpecsRef,
};
