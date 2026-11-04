const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'default',
  service: 'truckwithease-service',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

const upsertMyProfileRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertMyProfile', inputVars);
}
upsertMyProfileRef.operationName = 'UpsertMyProfile';
exports.upsertMyProfileRef = upsertMyProfileRef;

exports.upsertMyProfile = function upsertMyProfile(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertMyProfileRef(dcInstance, inputVars));
}
;

const updateMyLoadStatusRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMyLoadStatus', inputVars);
}
updateMyLoadStatusRef.operationName = 'UpdateMyLoadStatus';
exports.updateMyLoadStatusRef = updateMyLoadStatusRef;

exports.updateMyLoadStatus = function updateMyLoadStatus(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateMyLoadStatusRef(dcInstance, inputVars));
}
;

const updateMyVehicleSpecsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMyVehicleSpecs', inputVars);
}
updateMyVehicleSpecsRef.operationName = 'UpdateMyVehicleSpecs';
exports.updateMyVehicleSpecsRef = updateMyVehicleSpecsRef;

exports.updateMyVehicleSpecs = function updateMyVehicleSpecs(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(updateMyVehicleSpecsRef(dcInstance, inputVars));
}
;

const getMyProfileRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyProfile');
}
getMyProfileRef.operationName = 'GetMyProfile';
exports.getMyProfileRef = getMyProfileRef;

exports.getMyProfile = function getMyProfile(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyProfileRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listMyAssignedVehiclesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyAssignedVehicles');
}
listMyAssignedVehiclesRef.operationName = 'ListMyAssignedVehicles';
exports.listMyAssignedVehiclesRef = listMyAssignedVehiclesRef;

exports.listMyAssignedVehicles = function listMyAssignedVehicles(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listMyAssignedVehiclesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const listMyAssignedLoadsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListMyAssignedLoads');
}
listMyAssignedLoadsRef.operationName = 'ListMyAssignedLoads';
exports.listMyAssignedLoadsRef = listMyAssignedLoadsRef;

exports.listMyAssignedLoads = function listMyAssignedLoads(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(listMyAssignedLoadsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const getMyLoadByIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyLoadById', inputVars);
}
getMyLoadByIdRef.operationName = 'GetMyLoadById';
exports.getMyLoadByIdRef = getMyLoadByIdRef;

exports.getMyLoadById = function getMyLoadById(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getMyLoadByIdRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
