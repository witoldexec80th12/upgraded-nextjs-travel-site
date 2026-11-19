"""Deterministic response fixtures. Virtual time is never presented as live timing."""
import calendar
import json
from datetime import date, timedelta
from urllib.parse import urlparse

import requests


class FixtureSite:
    def __init__(self, system, start, scenario="available"):
        self.system, self.start, self.scenario = system, start, scenario
        self.calls = 0

    def respond(self, method, url, kind, kwargs):
        response = requests.Response()
        response.url = url
        response.status_code = 200
        response.encoding = "utf-8"
        if kind == "robots":
            content = "User-agent: *\nAllow: /\n"
            if self.scenario == "robots_denied":
                content = "User-agent: *\nDisallow: /\n"
        else:
            self.calls += 1
            if self.scenario == "timeout":
                raise requests.Timeout("Fixture timeout")
            if self.scenario == "denied":
                response.status_code = 403
                content = "Forbidden"
            elif self.scenario == "malformed":
                content = "<html>Unexpected maintenance page</html>"
            elif self.scenario == "challenge":
                content = "<html>Verify you are human</html>"
            elif self.scenario == "retry" and self.calls == 1:
                response.status_code = 429
                content = "Rate limited"
            elif self.system == "dibona_app":
                content = json.dumps(
                    {"available": False, "reason": "BLOCKED_DAYS"}
                    if self.scenario == "empty" else {"available": True}
                )
            elif self.system == "suedtirol":
                content = json.dumps([] if self.scenario == "empty" else [
                    {"date": self.start.isoformat(), "departures": [
                        {"departure": (self.start + timedelta(days=1)).isoformat(),
                         "rule": "departure_possible"}
                    ]}
                ])
            elif self.system == "foundation" and kind == "calendar":
                from hut_availability.checkers.foundation import IT_MONTHS
                today = date.today()
                params = kwargs["params"]
                offset = today.year * 12 + today.month - 1 + params["chm"]
                year, month = offset // 12, offset % 12 + 1
                month_name = next(name for name, value in IT_MONTHS.items() if value == month)
                klass = "occupato" if self.scenario == "empty" else "libero"
                content = (
                    f'<table id="TabDisp"><tr><th colspan="7">{month_name} {year}</th></tr><tr>'
                    + "".join(f'<td class="{klass}">{d}</td>' for d in range(1, calendar.monthrange(year, month)[1]+1))
                    + "</tr></table>"
                )
            elif self.system == "foundation":
                content = '<p>Dormitory</p><select name="beds"><option value="0">0</option><option value="4">4</option></select>'
            elif self.system == "bukly":
                params = kwargs["params"]
                adults = [int(n) for n in params["rooms"].split("|")]
                allocations = [] if self.scenario == "empty" else [{
                    "query": {"adults": n, "children": 0, "childrenAges": []},
                    "assignments": [{"room": {
                        "id": 1, "isCompatible": True, "minAvailability": 12,
                        "ratePlans": [{"id": 1, "sell_type": "bed",
                                       "minAvailability": 12, "total_guests": n,
                                       "restrictions": None}],
                    }}],
                } for n in adults]
                payload = {
                    "component": "modules/BookingEngine/resources/js/Pages/Index",
                    "props": {"bookingEngine": {
                        "hotel": {"slug": urlparse(url).hostname.split(".")[0]},
                        "form": {**params, "dateConfirmed": True},
                        "calendarRestrictions": {
                            "minDate": "2020-01-01", "maxDate": "2100-01-01",
                            "unavailableDates": [], "checkinRestricted": [], "checkoutRestricted": [],
                        },
                    }, "allocations": allocations},
                }
                content = '<script type="application/json" data-page="app">' + json.dumps(payload) + "</script>"
            elif self.scenario == "empty":
                content = "<p>Sold out</p>"
            else:
                content = '<div class="hotel-room__sub"><div class="hotel-room__sub-title">Dorm beds</div><div>Nr. beds</div><select name="data[Room][1]"><option value="0">0</option><option value="4">4</option></select></div>'
        response._content = content.encode()
        return response
