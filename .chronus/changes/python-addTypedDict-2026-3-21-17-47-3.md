---
# Change versionKind to one of: internal, fix, dependencies, feature, deprecation, breaking
changeKind: feature
packages:
  - "@typespec/http-client-python"
---

[python] Add a `models-mode: typeddict` option that generates `TypedDict` typing hints for input models in the `types.py` file. Also generate named union aliases in the `_unions.py` file (renamed from `_types.py`). `TypedDict` generation is scoped to `models-mode: typeddict`; the default `dpg` mode output is unchanged.
