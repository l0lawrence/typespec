from .microsoft_app_configuration import MicrosoftAppConfigurationFactory

SERVICE_FACTORIES = {
    "Microsoft.AppConfiguration": MicrosoftAppConfigurationFactory,
}


def get_factory(provider: str, client, subscription_id: str | None = None, api_version: str | None = None):
    try:
        factory_cls = SERVICE_FACTORIES[provider]
    except KeyError as exc:
        raise ValueError(f"Service provider '{provider}' is not supported.") from exc
    return factory_cls(client, provider, subscription_id, api_version)
