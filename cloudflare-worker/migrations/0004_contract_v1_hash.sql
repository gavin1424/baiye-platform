-- Contract v1.0's seeded placeholder is replaced with the SHA-256 of its fixed HTML.
UPDATE contract_versions
SET content_hash = '_cHDtcggwt7pxOOjwDtaW66BovDpru4LK-qtdrY6gKo'
WHERE id = 'contract_v1_0' AND version = 'v1.0' AND content_hash = 'draft';
