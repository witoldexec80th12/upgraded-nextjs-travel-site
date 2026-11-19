"""Add durable daily sweep settings and run tracking.

Revision ID: 0002_daily_sweep
Revises: 0001_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_daily_sweep"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sweep_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("people", sa.Integer(), server_default="2", nullable=False),
        sa.Column("timezone", sa.String(length=80), server_default="Europe/Madrid", nullable=False),
        sa.Column("run_at", sa.Time(), server_default="03:00:00", nullable=False),
        sa.Column("spreadsheet_id", sa.String(length=255), nullable=True),
        sa.Column("last_scheduled_date", sa.Date(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_sweep_settings_singleton"),
        sa.CheckConstraint("people BETWEEN 1 AND 12", name="ck_sweep_settings_people"),
        sa.CheckConstraint("date_to >= date_from", name="ck_sweep_settings_dates"),
    )
    op.execute(
        """
        INSERT INTO sweep_settings (id, enabled, date_from, date_to, people, timezone, run_at)
        VALUES (1, false, DATE '2026-06-01', DATE '2027-10-31', 2, 'Europe/Madrid', TIME '03:00')
        """
    )
    op.create_table(
        "sweep_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("run_date", sa.Date(), nullable=False, unique=True),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("people", sa.Integer(), nullable=False),
        sa.Column("timezone", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="queued", nullable=False),
        sa.Column("sheets_status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("sheets_error", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("huts_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("huts_done", sa.Integer(), server_default="0", nullable=False),
        sa.Column("manual_huts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'done', 'partial', 'failed')",
            name="ck_sweep_runs_status",
        ),
        sa.CheckConstraint(
            "sheets_status IN ('pending', 'syncing', 'done', 'failed')",
            name="ck_sweep_runs_sheets_status",
        ),
    )
    op.add_column(
        "check_jobs",
        sa.Column("airtable_status", sa.String(length=20), server_default="pending", nullable=False),
    )
    op.execute("UPDATE check_jobs SET airtable_status = 'not_applicable'")
    op.add_column("check_jobs", sa.Column("airtable_error", sa.Text(), nullable=True))
    op.add_column(
        "check_jobs",
        sa.Column(
            "sweep_run_id",
            sa.BigInteger(),
            sa.ForeignKey("sweep_runs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_check_jobs_sweep_run_id", "check_jobs", ["sweep_run_id"])


def downgrade() -> None:
    op.drop_index("ix_check_jobs_sweep_run_id", table_name="check_jobs")
    op.drop_column("check_jobs", "sweep_run_id")
    op.drop_column("check_jobs", "airtable_error")
    op.drop_column("check_jobs", "airtable_status")
    op.drop_table("sweep_runs")
    op.drop_table("sweep_settings")
