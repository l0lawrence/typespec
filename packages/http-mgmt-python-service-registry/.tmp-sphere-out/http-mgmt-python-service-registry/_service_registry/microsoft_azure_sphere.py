from typing import Any, Callable, Dict, Protocol, TypedDict, cast, Iterable

from azure.core.paging import ItemPaged
from azure.core.polling import LROPoller
from .service_factory import ServiceProviderFactory


class OperationsOperations(Protocol):
  def list(self, **kwargs: Any) -> ItemPaged[Any]: ...

class CatalogsOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def update(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByResourceGroup(self, subscriptionId: Any, resourceGroupName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def listBySubscription(self, subscriptionId: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def countDevices(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> Any: ...
  def listDeployments(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def listDeviceGroups(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def listDeviceInsights(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def listDevices(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def uploadImage(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> LROPoller[Any]: ...

class CertificatesOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, serialNumber: Any, **kwargs: Any) -> Any: ...
  def listByCatalog(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def retrieveCertChain(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, serialNumber: Any, **kwargs: Any) -> Any: ...
  def retrieveProofOfPossessionNonce(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, serialNumber: Any, **kwargs: Any) -> Any: ...

class ImagesOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, imageName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, imageName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, imageName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByCatalog(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...

class ProductsOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def update(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByCatalog(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def countDevices(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> Any: ...
  def generateDefaultDeviceGroups(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> Any: ...

class DeviceGroupsOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def update(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByProduct(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def claimDevices(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def countDevices(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> Any: ...

class DeploymentsOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deploymentName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deploymentName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deploymentName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByDeviceGroup(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> ItemPaged[Any]: ...

class DevicesOperations(Protocol):
  def get(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deviceName: Any, **kwargs: Any) -> Any: ...
  def createOrUpdate(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deviceName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def update(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deviceName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def delete(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deviceName: Any, **kwargs: Any) -> LROPoller[Any]: ...
  def listByDeviceGroup(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, **kwargs: Any) -> ItemPaged[Any]: ...
  def generateCapabilityImage(self, subscriptionId: Any, resourceGroupName: Any, catalogName: Any, productName: Any, deviceGroupName: Any, deviceName: Any, **kwargs: Any) -> LROPoller[Any]: ...


class OperationsByGroup(TypedDict):
    operations: OperationsOperations
    catalogs: CatalogsOperations
    certificates: CertificatesOperations
    images: ImagesOperations
    products: ProductsOperations
    device_groups: DeviceGroupsOperations
    deployments: DeploymentsOperations
    devices: DevicesOperations


class MicrosoftAzureSphereFactory(ServiceProviderFactory):
  def __init__(self, client: Any, service_provider: str, subscription_id: str | None = None, api_version: str | None = None):
    super().__init__(client, service_provider, subscription_id, api_version or "2024-04-01")

    self.routes_by_method: Dict[str, Dict[str, Callable[..., Any]]] = {
    "GET": {
                "list": (lambda **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/providers/Microsoft.AzureSphere/operations", path_params=None, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs)),
                "listByResourceGroup": (lambda subscriptionId, resourceGroupName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName}, **kwargs), **kwargs)),
                "listBySubscription": (lambda subscriptionId, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/providers/Microsoft.AzureSphere/catalogs", path_params={'subscriptionId': subscriptionId}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, serialNumber, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/certificates/{serialNumber}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'serialNumber': serialNumber}, **kwargs)),
                "listByCatalog": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/certificates", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, imageName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/images/{imageName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'imageName': imageName}, **kwargs)),
                "listByCatalog": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/images", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs)),
                "listByCatalog": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs)),
                "listByProduct": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deploymentName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/deployments/{deploymentName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deploymentName': deploymentName}, **kwargs)),
                "listByDeviceGroup": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/deployments", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs), **kwargs)),
                "get": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deviceName, **kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices/{deviceName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deviceName': deviceName}, **kwargs)),
                "listByDeviceGroup": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_item_paged(lambda **_kwargs: self.get("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs), **kwargs))
            },
    "PUT": {
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, imageName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/images/{imageName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'imageName': imageName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deploymentName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/deployments/{deploymentName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deploymentName': deploymentName}, **kwargs))),
                "createOrUpdate": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deviceName, **kwargs: self._create_lro_poller(self.put("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices/{deviceName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deviceName': deviceName}, **kwargs)))
            },
    "PATCH": {
                "update": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_lro_poller(self.patch("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs))),
                "update": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self._create_lro_poller(self.patch("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs))),
                "update": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_lro_poller(self.patch("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs))),
                "update": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deviceName, **kwargs: self._create_lro_poller(self.patch("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices/{deviceName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deviceName': deviceName}, **kwargs)))
            },
    "DELETE": {
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs))),
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, imageName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/images/{imageName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'imageName': imageName}, **kwargs))),
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs))),
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs))),
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deploymentName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/deployments/{deploymentName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deploymentName': deploymentName}, **kwargs))),
                "delete": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deviceName, **kwargs: self._create_lro_poller(self.delete("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices/{deviceName}", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deviceName': deviceName}, **kwargs)))
            },
    "POST": {
                "countDevices": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/countDevices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs)),
                "listDeployments": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/listDeployments", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "listDeviceGroups": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/listDeviceGroups", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "listDeviceInsights": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/listDeviceInsights", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "listDevices": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_item_paged(lambda **_kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/listDevices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs), **kwargs)),
                "uploadImage": (lambda subscriptionId, resourceGroupName, catalogName, **kwargs: self._create_lro_poller(self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/uploadImage", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName}, **kwargs))),
                "retrieveCertChain": (lambda subscriptionId, resourceGroupName, catalogName, serialNumber, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/certificates/{serialNumber}/retrieveCertChain", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'serialNumber': serialNumber}, **kwargs)),
                "retrieveProofOfPossessionNonce": (lambda subscriptionId, resourceGroupName, catalogName, serialNumber, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/certificates/{serialNumber}/retrieveProofOfPossessionNonce", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'serialNumber': serialNumber}, **kwargs)),
                "countDevices": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/countDevices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs)),
                "generateDefaultDeviceGroups": (lambda subscriptionId, resourceGroupName, catalogName, productName, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/generateDefaultDeviceGroups", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName}, **kwargs)),
                "claimDevices": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self._create_lro_poller(self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/claimDevices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs))),
                "countDevices": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, **kwargs: self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/countDevices", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName}, **kwargs)),
                "generateCapabilityImage": (lambda subscriptionId, resourceGroupName, catalogName, productName, deviceGroupName, deviceName, **kwargs: self._create_lro_poller(self.post("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.AzureSphere/catalogs/{catalogName}/products/{productName}/deviceGroups/{deviceGroupName}/devices/{deviceName}/generateCapabilityImage", path_params={'subscriptionId': subscriptionId, 'resourceGroupName': resourceGroupName, 'catalogName': catalogName, 'productName': productName, 'deviceGroupName': deviceGroupName, 'deviceName': deviceName}, **kwargs)))
            }
    }

    self._route_index: Dict[str, tuple[str, Callable[..., Any]]] = {
      "list": ("GET", self.get),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "update": ("PATCH", self.patch),
      "delete": ("DELETE", self.delete),
      "listByResourceGroup": ("GET", self.get),
      "listBySubscription": ("GET", self.get),
      "countDevices": ("POST", self.post),
      "listDeployments": ("POST", self.post),
      "listDeviceGroups": ("POST", self.post),
      "listDeviceInsights": ("POST", self.post),
      "listDevices": ("POST", self.post),
      "uploadImage": ("POST", self.post),
      "get": ("GET", self.get),
      "listByCatalog": ("GET", self.get),
      "retrieveCertChain": ("POST", self.post),
      "retrieveProofOfPossessionNonce": ("POST", self.post),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "delete": ("DELETE", self.delete),
      "listByCatalog": ("GET", self.get),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "update": ("PATCH", self.patch),
      "delete": ("DELETE", self.delete),
      "listByCatalog": ("GET", self.get),
      "countDevices": ("POST", self.post),
      "generateDefaultDeviceGroups": ("POST", self.post),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "update": ("PATCH", self.patch),
      "delete": ("DELETE", self.delete),
      "listByProduct": ("GET", self.get),
      "claimDevices": ("POST", self.post),
      "countDevices": ("POST", self.post),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "delete": ("DELETE", self.delete),
      "listByDeviceGroup": ("GET", self.get),
      "get": ("GET", self.get),
      "createOrUpdate": ("PUT", self.put),
      "update": ("PATCH", self.patch),
      "delete": ("DELETE", self.delete),
      "listByDeviceGroup": ("GET", self.get),
      "generateCapabilityImage": ("POST", self.post)
    }

    self.operations_by_group: OperationsByGroup = {
      "operations": cast(OperationsOperations, self),
      "catalogs": cast(CatalogsOperations, self),
      "certificates": cast(CertificatesOperations, self),
      "images": cast(ImagesOperations, self),
      "products": cast(ProductsOperations, self),
      "device_groups": cast(DeviceGroupsOperations, self),
      "deployments": cast(DeploymentsOperations, self),
      "devices": cast(DevicesOperations, self)
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
  def operations(self) -> OperationsOperations:
    return cast(OperationsOperations, self)

  @property
  def catalogs(self) -> CatalogsOperations:
    return cast(CatalogsOperations, self)

  @property
  def certificates(self) -> CertificatesOperations:
    return cast(CertificatesOperations, self)

  @property
  def images(self) -> ImagesOperations:
    return cast(ImagesOperations, self)

  @property
  def products(self) -> ProductsOperations:
    return cast(ProductsOperations, self)

  @property
  def device_groups(self) -> DeviceGroupsOperations:
    return cast(DeviceGroupsOperations, self)

  @property
  def deployments(self) -> DeploymentsOperations:
    return cast(DeploymentsOperations, self)

  @property
  def devices(self) -> DevicesOperations:
    return cast(DevicesOperations, self)
