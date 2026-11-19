"""Create hut inventory and append-only availability history.

Revision ID: 0001_initial
Revises:
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "huts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cluster", sa.String(length=80), nullable=False),
        sa.Column("system", sa.String(length=40), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("booking_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("key", name="uq_huts_key"),
    )
    op.create_table(
        "check_jobs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("requested_by", sa.String(length=80), server_default="admin", nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("people", sa.Integer(), nullable=False),
        sa.Column("hut_keys", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("force", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="queued", nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("huts_total", sa.Integer(), server_default="0", nullable=False),
        sa.Column("huts_done", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'done', 'failed')",
            name="ck_check_jobs_status",
        ),
    )
    op.create_table(
        "availability_checks",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column(
            "job_id",
            sa.BigInteger(),
            sa.ForeignKey("check_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hut_id", sa.Integer(), sa.ForeignKey("huts.id"), nullable=False),
        sa.Column("night", sa.Date(), nullable=False),
        sa.Column("people", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("beds_free", sa.Integer(), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('available', 'partial', 'full', 'closed', 'min_stay', 'error')",
            name="ck_availability_status",
        ),
    )
    op.create_index(
        "ix_availability_hut_night_people_checked",
        "availability_checks",
        ["hut_id", "night", "people", "checked_at"],
    )
    op.execute(
        """
        CREATE VIEW latest_availability AS
        SELECT id, job_id, hut_id, night, people, status, beds_free, detail, checked_at
        FROM (
            SELECT ac.*,
                   row_number() OVER (
                       PARTITION BY hut_id, night, people
                       ORDER BY checked_at DESC, id DESC
                   ) AS row_number
            FROM availability_checks AS ac
        ) AS ranked
        WHERE row_number = 1
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS latest_availability")
    op.drop_index("ix_availability_hut_night_people_checked", table_name="availability_checks")
    op.drop_table("availability_checks")
    op.drop_table("check_jobs")
    op.drop_table("huts")
