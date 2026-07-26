-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

create type user_role as enum ('user', 'template_maintainer', 'moderator', 'admin');
create type project_status as enum ('draft', 'published', 'expired');
create type page_status as enum ('published', 'expired', 'unpublished', 'disabled');
create type asset_kind as enum ('image', 'audio');
create type asset_source as enum ('upload', 'library');
create type asset_status as enum ('pending', 'ready', 'rejected');
create type template_status as enum ('draft', 'review', 'published', 'rejected', 'archived');
create type report_status as enum ('open', 'reviewing', 'actioned', 'rejected');
create type music_status as enum ('active', 'archived');
