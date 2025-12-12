from typing import Any, Callable, Dict, Protocol, TypedDict, cast, Iterable

from azure.core.paging import ItemPaged
from azure.core.polling import LROPoller
from .service_factory import ServiceProviderFactory
from .models.microsoft_app_configuration import ArmDeletedResponse, ArmResourceUpdatedResponse, ArmResponse, CheckNameAvailabilityParameters, NameAvailabilityStatus, OkResponse, RegenerateKeyParameters, ResourceListResult


class ConfigurationStoresOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> ArmResponse: ...
  def create(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> LROPoller[ArmResourceUpdatedResponse]: ...
  def update(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> LROPoller[ArmResponse]: ...
  def delete(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> LROPoller[ArmDeletedResponse]: ...
  def listByResourceGroup(self, subscriptionId: str, resourceGroupName: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...
  def list(self, subscriptionId: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...
  def listKeys(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...
  def regenerateKey(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, regenerate_key_parameters: RegenerateKeyParameters, **kwargs: Any) -> ArmResponse: ...

class DeletedConfigurationStoresOperations(Protocol):
  def getDeleted(self, subscriptionId: str, location: str, configStoreName: str, **kwargs: Any) -> ArmResponse: ...
  def purgeDeleted(self, subscriptionId: str, location: str, configStoreName: str, **kwargs: Any) -> LROPoller[OkResponse]: ...

class PrivateEndpointConnectionsOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: Any) -> ArmResponse: ...
  def createOrUpdate(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: Any) -> LROPoller[ArmResourceUpdatedResponse]: ...
  def delete(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: Any) -> LROPoller[ArmDeletedResponse]: ...
  def listByConfigurationStore(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...

class PrivateLinkResourcesOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, groupName: str, **kwargs: Any) -> ArmResponse: ...
  def listByConfigurationStore(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...

class KeyValuesOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: Any) -> ArmResponse: ...
  def createOrUpdate(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: Any) -> LROPoller[ArmResourceUpdatedResponse]: ...
  def delete(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: Any) -> LROPoller[ArmDeletedResponse]: ...

class ReplicasOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: Any) -> ArmResponse: ...
  def create(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: Any) -> LROPoller[ArmResourceUpdatedResponse]: ...
  def delete(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: Any) -> LROPoller[ArmDeletedResponse]: ...
  def listByConfigurationStore(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: Any) -> ItemPaged[ArmResponse]: ...

class SnapshotsOperations(Protocol):
  def get(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, snapshotName: str, **kwargs: Any) -> ArmResponse: ...
  def create(self, subscriptionId: str, resourceGroupName: str, configStoreName: str, snapshotName: str, **kwargs: Any) -> LROPoller[ArmResourceUpdatedResponse]: ...

class ConfigurationStoresOperationGroupOperations(Protocol):
  def listDeleted(self, subscriptionId: str, **kwargs: Any) -> ItemPaged[Any]: ...

class OperationsOperations(Protocol):
  def list(self, **kwargs: Any) -> ItemPaged[ArmResponse]: ...

class OperationsOperationGroupOperations(Protocol):
  def checkNameAvailability(self, subscriptionId: str, check_name_availability_parameters: CheckNameAvailabilityParameters, **kwargs: Any) -> NameAvailabilityStatus: ...
  def regionalCheckNameAvailability(self, subscriptionId: str, location: str, regional_check_name_availability_parameters: CheckNameAvailabilityParameters, **kwargs: Any) -> NameAvailabilityStatus: ...


class ModelsByName(TypedDict):
    arm_deleted_response: type[ArmDeletedResponse]
    arm_resource_updated_response: type[ArmResourceUpdatedResponse]
    arm_response: type[ArmResponse]
    check_name_availability_parameters: type[CheckNameAvailabilityParameters]
    name_availability_status: type[NameAvailabilityStatus]
    ok_response: type[OkResponse]
    regenerate_key_parameters: type[RegenerateKeyParameters]
    resource_list_result: type[ResourceListResult]


class OperationsByGroup(TypedDict):
    configuration_stores: ConfigurationStoresOperations
    deleted_configuration_stores: DeletedConfigurationStoresOperations
    private_endpoint_connections: PrivateEndpointConnectionsOperations
    private_link_resources: PrivateLinkResourcesOperations
    key_values: KeyValuesOperations
    replicas: ReplicasOperations
    snapshots: SnapshotsOperations
    configuration_stores_operation_group: ConfigurationStoresOperationGroupOperations
    operations: OperationsOperations
    operations_operation_group: OperationsOperationGroupOperations


class MicrosoftAppConfigurationFactory(ServiceProviderFactory):
  def __init__(self, client: Any, service_provider: str, subscription_id: str | None = None, api_version: str | None = None):
    super().__init__(client, service_provider, subscription_id, api_version or "2025-06-01-preview")

    self.routes_by_method: Dict[str, Dict[str, Callable[..., Any]]] = {
    "GET": {
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs)),
                "listByResourceGroup": (lambda subscriptionId: str, resourceGroupName: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName}, **kwargs), **kwargs)),
                "list": (lambda subscriptionId: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/configurationStores", path_params={'subscriptionId': subscriptionId}, **kwargs), **kwargs)),
                "getDeleted": (lambda subscriptionId: str, location: str, configStoreName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/locations/{location}/deletedConfigurationStores/{configStoreName}", path_params={'subscriptionId': subscriptionId, 'location': location, 'configStoreName': configStoreName}, **kwargs)),
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateEndpointConnections/{privateEndpointConnectionName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'privateEndpointConnectionName': privateEndpointConnectionName}, **kwargs)),
                "listByConfigurationStore": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateEndpointConnections", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, groupName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateLinkResources/{groupName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'groupName': groupName}, **kwargs)),
                "listByConfigurationStore": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateLinkResources", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/keyValues/{keyValueName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'keyValueName': keyValueName}, **kwargs)),
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/replicas/{replicaName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'replicaName': replicaName}, **kwargs)),
                "listByConfigurationStore": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/replicas", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, snapshotName: str, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/snapshots/{snapshotName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'snapshotName': snapshotName}, **kwargs)),
                "listDeleted": (lambda subscriptionId: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/deletedConfigurationStores", path_params={'subscriptionId': subscriptionId}, **kwargs), **kwargs)),
                "list": (lambda **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/providers/Microsoft.AppConfiguration/operations", path_params=None, **kwargs), **kwargs))
            },
    "PUT": {
                "create": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateEndpointConnections/{privateEndpointConnectionName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'privateEndpointConnectionName': privateEndpointConnectionName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/keyValues/{keyValueName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'keyValueName': keyValueName}, **kwargs))),
                "create": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/replicas/{replicaName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'replicaName': replicaName}, **kwargs))),
                "create": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, snapshotName: str, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/snapshots/{snapshotName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'snapshotName': snapshotName}, **kwargs)))
            },
    "PATCH": {
                "update": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_lro_poller(self.patch("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs)))
            },
    "DELETE": {
                "delete": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs))),
                "delete": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, privateEndpointConnectionName: str, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/privateEndpointConnections/{privateEndpointConnectionName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'privateEndpointConnectionName': privateEndpointConnectionName}, **kwargs))),
                "delete": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, keyValueName: str, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/keyValues/{keyValueName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'keyValueName': keyValueName}, **kwargs))),
                "delete": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, replicaName: str, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/replicas/{replicaName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName, 'replicaName': replicaName}, **kwargs)))
            },
    "POST": {
                "listKeys": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, **kwargs: self._create_item_paged(lambda **_kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/listKeys", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, **kwargs), **kwargs)),
                "regenerateKey": (lambda subscriptionId: str, resourceGroupName: str, configStoreName: str, regenerate_key_parameters: RegenerateKeyParameters, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AppConfiguration/configurationStores/{configStoreName}/regenerateKey", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'configStoreName': configStoreName}, body=regenerate_key_parameters, **kwargs)),
                "purgeDeleted": (lambda subscriptionId: str, location: str, configStoreName: str, **kwargs: self._create_lro_poller(self.post("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/locations/{location}/deletedConfigurationStores/{configStoreName}/purge", path_params={'subscriptionId': subscriptionId, 'location': location, 'configStoreName': configStoreName}, **kwargs))),
                "checkNameAvailability": (lambda subscriptionId: str, check_name_availability_parameters: CheckNameAvailabilityParameters, **kwargs: self.post("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/checkNameAvailability", path_params={'subscriptionId': subscriptionId}, body=check_name_availability_parameters, **kwargs)),
                "regionalCheckNameAvailability": (lambda subscriptionId: str, location: str, regional_check_name_availability_parameters: CheckNameAvailabilityParameters, **kwargs: self.post("/subscriptions/{subscriptionId}/providers/Microsoft.AppConfiguration/locations/{location}/checkNameAvailability", path_params={'subscriptionId': subscriptionId, 'location': location}, body=regional_check_name_availability_parameters, **kwargs))
            }
    }

    self._route_index: Dict[str, tuple[str, Callable[..., Any]]] = {
      "get": ("GET", self.get),
      "create": ("PUT", self.put),
      "update": ("PATCH", self.patch),
      "delete": ("DELETE", self.delete),
      "listByResourceGroup": ("GET", self.get),
      "list": ("GET", self.get),
      "listKeys": ("POST", self.post),
      "regenerateKey": ("POST", self.post),
      "getDeleted": ("GET", self.get),
      "purgeDeleted": ("POST", self.post),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "delete": ("DELETE", self.delete),
      "listByConfigurationStore": ("GET", self.get),
      "get": ("GET", self.get),
      "listByConfigurationStore": ("GET", self.get),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "delete": ("DELETE", self.delete),
      "get": ("GET", self.get),
      "create": ("PUT", self.put),
      "delete": ("DELETE", self.delete),
      "listByConfigurationStore": ("GET", self.get),
      "get": ("GET", self.get),
      "create": ("PUT", self.put),
      "listDeleted": ("GET", self.get),
      "list": ("GET", self.get),
      "checkNameAvailability": ("POST", self.post),
      "regionalCheckNameAvailability": ("POST", self.post)
    }

    self.operations_by_group: OperationsByGroup = {
      "configuration_stores": cast(ConfigurationStoresOperations, self),
      "deleted_configuration_stores": cast(DeletedConfigurationStoresOperations, self),
      "private_endpoint_connections": cast(PrivateEndpointConnectionsOperations, self),
      "private_link_resources": cast(PrivateLinkResourcesOperations, self),
      "key_values": cast(KeyValuesOperations, self),
      "replicas": cast(ReplicasOperations, self),
      "snapshots": cast(SnapshotsOperations, self),
      "configuration_stores_operation_group": cast(ConfigurationStoresOperationGroupOperations, self),
      "operations": cast(OperationsOperations, self),
      "operations_operation_group": cast(OperationsOperationGroupOperations, self)
    }

  def _call_route(self, verb: str, operation: str, *args: Any, **kwargs: Any) -> Any:
    try:
      handler = self.routes_by_method[verb][operation]
    except KeyError as exc:
      raise AttributeError(f"Operation '{operation}' not registered for verb '{verb}'") from exc
    return handler(*args, **kwargs)

  def __getattr__(self, name: str) -> Any:
    route = self._route_index.get(name)
    if route is None:
      raise AttributeError(f"{type(self).__name__} has no attribute '{name}'")

    verb, handler = route

    def _bound(*args: Any, **kwargs: Any) -> Any:
      return self._call_route(verb, name, *args, **kwargs)

    return _bound

  @property
  def configuration_stores(self) -> ConfigurationStoresOperations:
    return cast(ConfigurationStoresOperations, self)

  @property
  def deleted_configuration_stores(self) -> DeletedConfigurationStoresOperations:
    return cast(DeletedConfigurationStoresOperations, self)

  @property
  def private_endpoint_connections(self) -> PrivateEndpointConnectionsOperations:
    return cast(PrivateEndpointConnectionsOperations, self)

  @property
  def private_link_resources(self) -> PrivateLinkResourcesOperations:
    return cast(PrivateLinkResourcesOperations, self)

  @property
  def key_values(self) -> KeyValuesOperations:
    return cast(KeyValuesOperations, self)

  @property
  def replicas(self) -> ReplicasOperations:
    return cast(ReplicasOperations, self)

  @property
  def snapshots(self) -> SnapshotsOperations:
    return cast(SnapshotsOperations, self)

  @property
  def configuration_stores_operation_group(self) -> ConfigurationStoresOperationGroupOperations:
    return cast(ConfigurationStoresOperationGroupOperations, self)

  @property
  def operations(self) -> OperationsOperations:
    return cast(OperationsOperations, self)

  @property
  def operations_operation_group(self) -> OperationsOperationGroupOperations:
    return cast(OperationsOperationGroupOperations, self)
