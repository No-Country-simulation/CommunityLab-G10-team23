from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "CommunityLab G10 Team 23"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(extra="ignore")


settings = Settings()