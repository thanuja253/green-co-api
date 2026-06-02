# Checklist versioning API (frontend guide)

Base URL: your `VITE_API_BASE_URL` (e.g. `https://green-co-api-1.onrender.com`).

Admin routes use `Authorization: Bearer <admin_token>` unless whitelisted elsewhere.

## Concepts

| Field | Location |
|-------|----------|
| `checklist_version_id` | `companies_projects` |
| `version_locked` | `companies_projects` (true = cannot reassign) |
| Version status | `draft` → `active` → `archived` |
| Parameters per version | `master_checklist_sectors.checklist_version_id` |
| Credits per version (optional) | `credit_managements.checklist_version_id` + `group_id` |

## Group version APIs

### List versions
`GET /api/admin/groups/:groupId/checklist-versions`

### Get active version (for new projects)
`GET /api/admin/groups/:groupId/checklist-versions/active`

### Get one version
`GET /api/admin/groups/:groupId/checklist-versions/:versionId`

### Create draft (or clone via body)
`POST /api/admin/groups/:groupId/checklist-versions`

```json
{
  "label": "Version 2",
  "change_notes": "Added renewable tracking",
  "clone_from_version_id": "<optional source version id>"
}
```

### Clone explicitly
`POST /api/admin/groups/:groupId/checklist-versions/:versionId/clone`

### Update draft only
`PATCH /api/admin/groups/:groupId/checklist-versions/:versionId`

```json
{
  "label": "Version 2",
  "checklist_document": "uploads/groups/versions/..."
}
```

### Upload checklist file (draft)
`POST /api/admin/groups/:groupId/checklist-versions/:versionId/checklist-document`  
`multipart/form-data` field: `checklist_document`

### Activate (archives previous active)
`POST /api/admin/groups/:groupId/checklist-versions/:versionId/activate`

### Archive
`POST /api/admin/groups/:groupId/checklist-versions/:versionId/archive`

### Version parameters
`GET /api/admin/groups/:groupId/checklist-versions/:versionId/parameters`

### Version credits
`GET /api/admin/groups/:groupId/checklist-versions/:versionId/credits`

## Project APIs

### Get assigned version
`GET /api/admin/projects/:projectId/checklist-version`

### Pin active group version + lock
`POST /api/admin/projects/:projectId/checklist-version/pin`  
Query `?force=true` to override an existing lock (admin only).

## One-time migration (after deploy)

`POST /api/admin/checklist-versions/migrate/backfill`

Creates **V1 (active)** for every group, links legacy parameters, backfills projects without `checklist_version_id`.

## Frontend flows

1. **Admin → Group → Versions tab**  
   List → Create/Clone draft → Edit parameters/credits for that `versionId` → Activate.

2. **New project**  
   On pinning stage: `POST .../checklist-version/pin` (or backend auto-pin when you add that hook).

3. **Company / assessor views**  
   Read `project.checklist_version_id` from project API, then load parameters/checklist/credits filtered by that version id.

## Legacy endpoints (still work)

- `GET /api/admin/checklist-versions?checklist_id=<groupId>`
- Enhanced-features routes under `/api/admin/checklist-versions` (older shape)

New UI should prefer `/api/admin/groups/:groupId/checklist-versions/*`.
