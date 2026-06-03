"""Pydantic models for CheckMK priority rules."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

SUPPORTED_KEYS = frozenset(
    {
        "role",
        "status",
        "location",
        "manufacturer",
        "device_type",
        "platform",
        "custom_field",
        "ip_prefix",
    }
)


class ExpressionCondition(BaseModel):
    type: Literal["condition"] = "condition"
    key: str
    field: Optional[str] = None
    value: str

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if v not in SUPPORTED_KEYS:
            raise ValueError(
                f"Unsupported key '{v}'. Must be one of: {sorted(SUPPORTED_KEYS)}"
            )
        return v

    @field_validator("field")
    @classmethod
    def validate_field(cls, v: Optional[str], info) -> Optional[str]:
        key = info.data.get("key")
        if key == "custom_field" and not v:
            raise ValueError("'field' is required when key is 'custom_field'")
        if key != "custom_field" and v is not None:
            raise ValueError("'field' is only allowed when key is 'custom_field'")
        return v


class ExpressionConnector(BaseModel):
    type: Literal["connector"] = "connector"
    operator: Literal["and", "or"]


ExpressionItem = Annotated[
    Union[ExpressionCondition, ExpressionConnector],
    Field(discriminator="type"),
]


class CheckMKPriorityRuleCreate(BaseModel):
    priority_order: int = Field(ge=0)
    filename: str
    expression: List[ExpressionItem]

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: str) -> str:
        if not v.endswith(".yaml"):
            raise ValueError("Filename must end with .yaml")
        if "/" in v or "\\" in v:
            raise ValueError("Filename must not contain path separators")
        return v

    @field_validator("expression")
    @classmethod
    def validate_expression(cls, v: List[ExpressionItem]) -> List[ExpressionItem]:
        if not v:
            raise ValueError("Expression must not be empty")
        for i, item in enumerate(v):
            expected = "condition" if i % 2 == 0 else "connector"
            if item.type != expected:
                raise ValueError(
                    f"Item at index {i} must be a '{expected}', got '{item.type}'"
                )
        return v


class CheckMKPriorityRuleUpdate(BaseModel):
    priority_order: Optional[int] = Field(default=None, ge=0)
    filename: Optional[str] = None
    expression: Optional[List[ExpressionItem]] = None

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.endswith(".yaml"):
            raise ValueError("Filename must end with .yaml")
        if "/" in v or "\\" in v:
            raise ValueError("Filename must not contain path separators")
        return v

    @field_validator("expression")
    @classmethod
    def validate_expression(
        cls, v: Optional[List[ExpressionItem]]
    ) -> Optional[List[ExpressionItem]]:
        if v is None:
            return v
        if not v:
            raise ValueError("Expression must not be empty")
        for i, item in enumerate(v):
            expected = "condition" if i % 2 == 0 else "connector"
            if item.type != expected:
                raise ValueError(
                    f"Item at index {i} must be a '{expected}', got '{item.type}'"
                )
        return v


class CheckMKPriorityRuleResponse(BaseModel):
    id: int
    priority_order: int
    filename: str
    expression: List[ExpressionItem]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CheckMKPriorityRulesReorderRequest(BaseModel):
    rule_ids: List[int]
