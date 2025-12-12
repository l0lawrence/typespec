from __future__ import annotations
from typing import TypedDict, NotRequired, Required


class AcceptedResponse(TypedDict, total=False):
    "statusCode": Required[float]

class ApiKey(TypedDict, total=False):
    "id": NotRequired[str]
    "name": NotRequired[str]
    "value": NotRequired[str]
    "connectionString": NotRequired[str]
    "lastModified": NotRequired[str]
    "readOnly": NotRequired[bool]

class ApiKeyListResult(TypedDict, total=False):
    "value": Required[list[Any]]
    "nextLink": NotRequired[ResourceLocation]

class ApiVersionParameter(TypedDict, total=False):
    "apiVersion": Required[str]

class ArmAcceptedLroResponse(TypedDict, total=False):
    "statusCode": Required[float]
    "azureAsyncOperation": NotRequired[str]
    "retryAfter": NotRequired[int]

class ArmAsyncOperationHeader(TypedDict, total=False):
    "azureAsyncOperation": NotRequired[str]

class ArmCombinedLroHeaders(TypedDict, total=False):
    "azureAsyncOperation": NotRequired[ResourceLocation]
    "location": NotRequired[str]

class ArmDeleteAcceptedLroResponse(TypedDict, total=False):
    "statusCode": Required[float]
    "azureAsyncOperation": NotRequired[str]
    "retryAfter": NotRequired[int]

class ArmDeletedNoContentResponse(TypedDict, total=False):
    "statusCode": Required[float]

class ArmDeletedResponse(TypedDict, total=False):
    "statusCode": Required[float]

class ArmLroLocationHeader(TypedDict, total=False):
    "location": NotRequired[str]

class ArmNoContentResponse(TypedDict, total=False):
    "statusCode": Required[float]

class ArmOperationStatus(TypedDict, total=False):
    "properties": NotRequired[Never]
    "status": Required[Any]
    "id": Required[str]
    "name": NotRequired[str]
    "startTime": NotRequired[str]
    "endTime": NotRequired[str]
    "percentComplete": NotRequired[float]
    "error": NotRequired[ErrorDetail]

class ArmResourceCreatedResponse(TypedDict, total=False):
    "statusCode": Required[float]
    "azureAsyncOperation": NotRequired[str]
    "retryAfter": NotRequired[int]
    "body": Required[Snapshot]

class ArmResourceUpdatedResponse(TypedDict, total=False):
    "statusCode": Required[float]
    "body": Required[Snapshot]

class ArmResponse(TypedDict, total=False):
    "statusCode": Required[float]
    "body": Required[Snapshot]

class Array(TypedDict, total=False):
    pass

class AzureFrontDoorProperties(TypedDict, total=False):
    "resourceId": NotRequired[ArmResourceIdentifier]

class CheckNameAvailabilityParameters(TypedDict, total=False):
    "name": Required[str]
    "type": Required[Any]

class ConfigurationStore(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "tags": NotRequired[Dict[str, Any]]
    "location": Required[AzureLocation]
    "properties": NotRequired[ConfigurationStoreProperties]
    "identity": NotRequired[ResourceIdentity]
    "sku": Required[Sku]

class ConfigurationStoreProperties(TypedDict, total=False):
    "provisioningState": NotRequired[Any]
    "creationDate": NotRequired[str]
    "endpoint": NotRequired[str]
    "encryption": NotRequired[EncryptionProperties]
    "privateEndpointConnections": NotRequired[list[Any]]
    "publicNetworkAccess": NotRequired[Any]
    "disableLocalAuth": NotRequired[bool]
    "softDeleteRetentionInDays": NotRequired[int]
    "defaultKeyValueRevisionRetentionPeriodInSeconds": NotRequired[int]
    "enablePurgeProtection": NotRequired[bool]
    "dataPlaneProxy": NotRequired[DataPlaneProxyProperties]
    "createMode": NotRequired[CreateMode]
    "telemetry": NotRequired[TelemetryProperties]
    "managedOnBehalfOfConfiguration": NotRequired[ManagedOnBehalfOfConfiguration]
    "azureFrontDoor": NotRequired[AzureFrontDoorProperties]

class ConfigurationStorePropertiesUpdateParameters(TypedDict, total=False):
    "encryption": NotRequired[EncryptionProperties]
    "disableLocalAuth": NotRequired[bool]
    "publicNetworkAccess": NotRequired[Any]
    "enablePurgeProtection": NotRequired[bool]
    "dataPlaneProxy": NotRequired[DataPlaneProxyProperties]
    "defaultKeyValueRevisionRetentionPeriodInSeconds": NotRequired[int]
    "telemetry": NotRequired[TelemetryProperties]
    "azureFrontDoor": NotRequired[AzureFrontDoorProperties]

class ConfigurationStoreUpdateParameters(TypedDict, total=False):
    "properties": NotRequired[ConfigurationStorePropertiesUpdateParameters]
    "identity": NotRequired[ResourceIdentity]
    "sku": NotRequired[Sku]
    "tags": NotRequired[Dict[str, Any]]

class CreatedResponse(TypedDict, total=False):
    "statusCode": Required[float]

class DataPlaneProxyProperties(TypedDict, total=False):
    "authenticationMode": NotRequired[Any]
    "privateLinkDelegation": NotRequired[Any]

class DefaultBaseParameters(TypedDict, total=False):
    "apiVersion": Required[str]
    "subscriptionId": Required[str]
    "location": Required[str]
    "resourceGroupName": Required[str]
    "resourceUri": Required[str]

class DeletedConfigurationStore(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[DeletedConfigurationStoreProperties]

class DeletedConfigurationStoreProperties(TypedDict, total=False):
    "configurationStoreId": NotRequired[str]
    "location": NotRequired[str]
    "deletionDate": NotRequired[str]
    "scheduledPurgeDate": NotRequired[str]
    "tags": NotRequired[Dict[str, Any]]
    "purgeProtectionEnabled": NotRequired[bool]

class EncryptionProperties(TypedDict, total=False):
    "keyVaultProperties": NotRequired[KeyVaultProperties]

class ErrorAdditionalInfo(TypedDict, total=False):
    "type": NotRequired[str]
    "info": NotRequired[Unknown]

class ErrorDetail(TypedDict, total=False):
    "code": NotRequired[str]
    "message": NotRequired[str]
    "target": NotRequired[str]
    "details": NotRequired[list[Any]]
    "additionalInfo": NotRequired[list[Any]]

class ErrorResponse(TypedDict, total=False):
    "error": NotRequired[ErrorDetail]

class KeysOf(TypedDict, total=False):
    "configStoreName": Required[str]
    "snapshotName": Required[str]

class KeyValue(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[KeyValueProperties]

class KeyValueFilter(TypedDict, total=False):
    "key": Required[str]
    "label": NotRequired[str]

class KeyValueProperties(TypedDict, total=False):
    "key": NotRequired[str]
    "label": NotRequired[str]
    "value": NotRequired[str]
    "contentType": NotRequired[str]
    "eTag": NotRequired[str]
    "lastModified": NotRequired[str]
    "locked": NotRequired[bool]
    "tags": NotRequired[Dict[str, Any]]

class KeyVaultProperties(TypedDict, total=False):
    "keyIdentifier": NotRequired[str]
    "identityClientId": NotRequired[str]

class LocationParameter(TypedDict, total=False):
    "location": Required[str]

class LogSpecification(TypedDict, total=False):
    "name": NotRequired[str]
    "displayName": NotRequired[str]
    "blobDuration": NotRequired[str]

class ManagedOnBehalfOfConfiguration(TypedDict, total=False):
    "moboBrokerResources": NotRequired[list[Any]]

class MetricDimension(TypedDict, total=False):
    "name": NotRequired[str]
    "displayName": NotRequired[str]
    "internalName": NotRequired[str]

class MetricSpecification(TypedDict, total=False):
    "name": NotRequired[str]
    "displayName": NotRequired[str]
    "displayDescription": NotRequired[str]
    "unit": NotRequired[str]
    "aggregationType": NotRequired[str]
    "internalMetricName": NotRequired[str]
    "dimensions": NotRequired[list[Any]]
    "fillGapWithZero": NotRequired[bool]

class MoboBrokerResource(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]

class Model(TypedDict, total=False):
    pass

class ModelProperty(TypedDict, total=False):
    pass

class NameAvailabilityStatus(TypedDict, total=False):
    "nameAvailable": NotRequired[bool]
    "message": NotRequired[str]
    "reason": NotRequired[str]

class NoContentResponse(TypedDict, total=False):
    "statusCode": Required[float]

class OkResponse(TypedDict, total=False):
    "statusCode": Required[float]

class OperationDefinition(TypedDict, total=False):
    "name": NotRequired[str]
    "isDataAction": NotRequired[bool]
    "display": NotRequired[OperationDefinitionDisplay]
    "origin": NotRequired[str]
    "properties": NotRequired[OperationProperties]

class OperationDefinitionDisplay(TypedDict, total=False):
    "provider": NotRequired[str]
    "resource": NotRequired[str]
    "operation": NotRequired[str]
    "description": NotRequired[str]

class OperationDefinitionListResult(TypedDict, total=False):
    "value": NotRequired[list[Any]]
    "nextLink": NotRequired[str]

class OperationProperties(TypedDict, total=False):
    "serviceSpecification": NotRequired[ServiceSpecification]

class Page(TypedDict, total=False):
    "value": Required[list[Any]]
    "nextLink": NotRequired[ResourceLocation]

class ParentKeysOf(TypedDict, total=False):
    pass

class PollingOptions(TypedDict, total=False):
    "kind": Required[Any]
    "pollingModel": NotRequired[Any]
    "finalResult": NotRequired[Any]

class PrivateEndpoint(TypedDict, total=False):
    "id": NotRequired[str]

class PrivateEndpointConnection(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[PrivateEndpointConnectionProperties]

class PrivateEndpointConnectionProperties(TypedDict, total=False):
    "provisioningState": NotRequired[Any]
    "privateEndpoint": NotRequired[PrivateEndpoint]
    "privateLinkServiceConnectionState": Required[PrivateLinkServiceConnectionState]

class PrivateEndpointConnectionReference(TypedDict, total=False):
    "id": NotRequired[str]
    "name": NotRequired[str]
    "type": NotRequired[str]
    "properties": NotRequired[PrivateEndpointConnectionProperties]

class PrivateLinkResource(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[PrivateLinkResourceProperties]

class PrivateLinkResourceProperties(TypedDict, total=False):
    "groupId": NotRequired[str]
    "requiredMembers": NotRequired[list[Any]]
    "requiredZoneNames": NotRequired[list[Any]]

class PrivateLinkServiceConnectionState(TypedDict, total=False):
    "status": NotRequired[Any]
    "description": NotRequired[str]
    "actionsRequired": NotRequired[Any]

class ProviderNamespace(TypedDict, total=False):
    "provider": Required[str]

class ProxyResource(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[KeyValueProperties]

class Record(TypedDict, total=False):
    pass

class RegenerateKeyParameters(TypedDict, total=False):
    "id": NotRequired[str]

class Replica(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[ReplicaProperties]
    "location": NotRequired[str]

class ReplicaProperties(TypedDict, total=False):
    "endpoint": NotRequired[str]
    "provisioningState": NotRequired[Any]

class Resource(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]

class ResourceGroupNameParameter(TypedDict, total=False):
    "resourceGroupName": Required[str]

class ResourceIdentity(TypedDict, total=False):
    "type": NotRequired[Any]
    "userAssignedIdentities": NotRequired[Dict[str, Any]]
    "principalId": NotRequired[str]
    "tenantId": NotRequired[str]

class ResourceInstanceParameters(TypedDict, total=False):
    "apiVersion": Required[str]
    "subscriptionId": Required[str]
    "location": Required[str]
    "resourceGroupName": Required[str]
    "resourceUri": Required[str]
    "provider": Required[str]
    "configStoreName": Required[str]
    "snapshotName": Required[str]

class ResourceListResult(TypedDict, total=False):
    "value": Required[list[Any]]
    "nextLink": NotRequired[ResourceLocation]

class ResourceNameParameter(TypedDict, total=False):
    "name": Required[str]

class ResourceParentParameters(TypedDict, total=False):
    "apiVersion": Required[str]
    "subscriptionId": Required[str]
    "provider": Required[str]

class ResourceUriParameter(TypedDict, total=False):
    "resourceUri": Required[str]

class Response(TypedDict, total=False):
    "statusCode": Required[float]

class RetryAfterHeader(TypedDict, total=False):
    "retryAfter": NotRequired[int]

class ServiceSpecification(TypedDict, total=False):
    "logSpecifications": NotRequired[list[Any]]
    "metricSpecifications": NotRequired[list[Any]]

class Sku(TypedDict, total=False):
    "name": Required[str]

class Snapshot(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "properties": NotRequired[SnapshotProperties]

class SnapshotProperties(TypedDict, total=False):
    "provisioningState": NotRequired[Any]
    "status": NotRequired[Any]
    "filters": Required[list[Any]]
    "compositionType": NotRequired[Any]
    "created": NotRequired[str]
    "expires": NotRequired[str]
    "retentionPeriod": NotRequired[int]
    "size": NotRequired[int]
    "itemsCount": NotRequired[int]
    "tags": NotRequired[Dict[str, Any]]
    "etag": NotRequired[str]

class StatusMonitorOptions(TypedDict, total=False):
    "kind": Required[Any]
    "pollingModel": NotRequired[Any]
    "finalResult": NotRequired[Any]
    "finalProperty": NotRequired[Any]

class StatusMonitorPollingOptions(TypedDict, total=False):
    "kind": Required[Any]
    "pollingModel": NotRequired[Any]
    "finalResult": NotRequired[Any]
    "finalProperty": NotRequired[Any]

class SubscriptionActionScope(TypedDict, total=False):
    "name": Required[str]

class SubscriptionBaseParameters(TypedDict, total=False):
    "apiVersion": Required[str]
    "subscriptionId": Required[str]

class SubscriptionIdParameter(TypedDict, total=False):
    "subscriptionId": Required[str]

class SubscriptionScope(TypedDict, total=False):
    "apiVersion": Required[str]
    "subscriptionId": Required[str]
    "provider": Required[str]

class SystemData(TypedDict, total=False):
    "createdBy": NotRequired[str]
    "createdByType": NotRequired[Any]
    "createdAt": NotRequired[str]
    "lastModifiedBy": NotRequired[str]
    "lastModifiedByType": NotRequired[Any]
    "lastModifiedAt": NotRequired[str]

class TelemetryProperties(TypedDict, total=False):
    "resourceId": NotRequired[ArmResourceIdentifier]

class TenantBaseParameters(TypedDict, total=False):
    "apiVersion": Required[str]

class TrackedResource(TypedDict, total=False):
    "id": NotRequired[ArmResourceIdentifier]
    "name": NotRequired[str]
    "type": NotRequired[ArmResourceType]
    "systemData": NotRequired[SystemData]
    "tags": NotRequired[Dict[str, Any]]
    "location": Required[AzureLocation]
    "properties": NotRequired[ConfigurationStoreProperties]

class UserIdentity(TypedDict, total=False):
    "principalId": NotRequired[str]
    "clientId": NotRequired[str]
