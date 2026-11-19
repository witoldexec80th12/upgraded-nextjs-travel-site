from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Time,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Hut(Base):
    __tablename__ = "huts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cluster: Mapped[str] = mapped_column(String(80), nullable=False)
    system: Mapped[str] = mapped_column(String(40), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    booking_url: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class CheckJob(Base):
    __tablename__ = "check_jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_by: Mapped[str] = mapped_column(String(80), nullable=False, default="admin")
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    people: Mapped[int] = mapped_column(Integer, nullable=False)
    hut_keys: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    force: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    error: Mapped[str | None] = mapped_column(Text)
    huts_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    huts_done: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    airtable_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    airtable_error: Mapped[str | None] = mapped_column(Text)
    sweep_run_id: Mapped[int | None] = mapped_column(
        ForeignKey("sweep_runs.id", ondelete="SET NULL")
    )


class SweepSettings(Base):
    __tablename__ = "sweep_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    people: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    timezone: Mapped[str] = mapped_column(
        String(80), nullable=False, default="Europe/Madrid"
    )
    run_at: Mapped[time] = mapped_column(Time, nullable=False, default=time(3, 0))
    spreadsheet_id: Mapped[str | None] = mapped_column(String(255))
    last_scheduled_date: Mapped[date | None] = mapped_column(Date)


class SweepRun(Base):
    __tablename__ = "sweep_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    people: Mapped[int] = mapped_column(Integer, nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    sheets_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    sheets_error: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    huts_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    huts_done: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    manual_huts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AvailabilityCheck(Base):
    __tablename__ = "availability_checks"
    __table_args__ = (
        Index(
            "ix_availability_hut_night_people_checked",
            "hut_id",
            "night",
            "people",
            "checked_at",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("check_jobs.id", ondelete="CASCADE"), nullable=False
    )
    hut_id: Mapped[int] = mapped_column(ForeignKey("huts.id"), nullable=False)
    night: Mapped[date] = mapped_column(Date, nullable=False)
    people: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    beds_free: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
