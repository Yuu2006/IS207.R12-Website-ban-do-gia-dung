-- Apply after 025_return_line_items.sql; this is an optional customer reference image, never analyzed by FIT-02.
ALTER TABLE installation_checklists
    ADD COLUMN reference_photo_url VARCHAR(500) NULL;
