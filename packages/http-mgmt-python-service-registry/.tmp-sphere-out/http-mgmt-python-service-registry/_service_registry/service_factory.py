from typing import Any, Dict, Optional

from azure.core.paging import ItemPaged
from azure.core.polling import LROPoller, NoPolling, PollingMethod
from azure.core.rest import HttpRequest, HttpResponse
from azure.core.pipeline import PipelineResponse, PipelineContext


class ServiceProviderFactory:
    """Base factory with convenience HTTP helpers."""

    def __init__(self, client: Any, service_provider: str, subscription_id: Optional[str] = None, api_version: Optional[str] = None) -> None:
        self.client = client
        self.service_provider = service_provider
        self.subscription_id = subscription_id
        self.api_version = api_version or "latest"

    def _format_url(self, path: str, path_params: Optional[Dict[str, Any]] = None) -> str:
        try:
            return path.format(**(path_params or {}))
        except KeyError as exc:
            missing = exc.args[0]
            raise ValueError(f"Missing path parameter: {missing}") from exc

    def _with_api_version(self, url: str, api_version: Optional[str] = None) -> str:
        version = api_version or self.api_version
        separator = "&" if "?" in url else "?"
        return f"{url}{separator}api-version={version}"

    def _send(self, request: HttpRequest, **kwargs: Any) -> HttpResponse:
        return self.client._send_request(request, **kwargs)

    def get(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("GET", url)
        return self._send(request, **kwargs)

    def post(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("POST", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def put(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("PUT", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def patch(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, body: Any = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("PATCH", url)
        if body is not None:
            request.set_json_body(body)
        return self._send(request, **kwargs)

    def delete(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("DELETE", url)
        return self._send(request, **kwargs)

    def head(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("HEAD", url)
        return self._send(request, **kwargs)

    def options(self, path: str, *, path_params: Optional[Dict[str, Any]] = None, api_version: Optional[str] = None, **kwargs: Any) -> HttpResponse:
        url = self._with_api_version(self._format_url(path, path_params), api_version)
        request = HttpRequest("OPTIONS", url)
        return self._send(request, **kwargs)

    def _create_item_paged(self, first_page: Callable[..., HttpResponse], *args: Any, **kwargs: Any) -> ItemPaged[Any]:
      def extract_data(response: HttpResponse) -> tuple[list[Any], str | None]:
        data = response.json() if hasattr(response, "json") else None
        if isinstance(data, dict):
          items = data.get("value") or data.get("items") or []
          if isinstance(items, dict):
            items = list(items.values())
          next_link = data.get("nextLink") or data.get("next_page_link") or data.get("next_page") or data.get("nextLinkName")
        elif isinstance(data, list):
          items = data
          next_link = None
        else:
          items = [] if data is None else [data]
          next_link = None
        return list(items), next_link

      def get_next(continuation_token: str | None = None):
        if continuation_token:
          resp = self.get(continuation_token, path_params=None, api_version=None, **kwargs)
        else:
          resp = first_page(*args, **kwargs)

        items, next_link = extract_data(resp)
        return items, next_link

      return ItemPaged(get_next)

    def _create_lro_poller(self, response: HttpResponse, **kwargs: Any) -> LROPoller[Any]:
        polling: PollingMethod | bool | None = kwargs.pop("polling", True)

        def get_output(pipeline_response: PipelineResponse) -> Any:
          json = pipeline_response.http_response.json if hasattr(pipeline_response.http_response, "json") else None
          return json() if callable(json) else None

        if polling is True or polling is None:
          polling_method: PollingMethod = NoPolling()
        elif polling is False:
          polling_method = NoPolling()
        else:
          polling_method = polling

        pipeline_response = PipelineResponse(HttpRequest("GET", response.request.url), response, PipelineContext(None))
        return LROPoller[Any](
          client=self.client._client if hasattr(self.client, "_client") else self.client,
          initial_response=pipeline_response,
          deserialization_callback=get_output,
          polling_method=polling_method,
        )
