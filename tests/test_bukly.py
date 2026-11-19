import html
import json
import unittest
from datetime import date, timedelta
from unittest.mock import Mock, patch

import requests

from hut_availability.checkers.bukly import check_bukly, legacy_result
from hut_availability.checkers.bukly_v2 import (
    BuklyResponseError, calendar, fit, layouts, page_payload,
)

DAY = date(2027, 6, 28)


def room(rid=1, quantity=6, unit="bed", adults=2, plan=1, compatible=True):
    return {"id": rid, "minAvailability": quantity, "isCompatible": compatible,
            "ratePlans": [{"id": plan, "sell_type": unit, "minAvailability": quantity,
                           "total_guests": adults, "restrictions": None}]}


def allocation(adults, rooms):
    return {"query": {"adults": adults, "children": 0, "childrenAges": []},
            "assignments": [{"room": r} for r in rooms]}


def payload(params=None, allocations=None, slug="scotoni"):
    params = params or {"checkin": str(DAY), "checkout": str(DAY + timedelta(days=1)), "rooms": "2"}
    return {"component": "modules/BookingEngine/resources/js/Pages/Index", "props": {
        "bookingEngine": {
            "hotel": {"slug": slug, "reservation_per_request": 0},
            "form": {**params, "dateConfirmed": True},
            "allocations": [],  # Critical: this is NOT the live result.
            "calendarRestrictions": {
                "minDate": "2026-11-10", "maxDate": "2028-03-11",
                "unavailableDates": [], "checkinRestricted": [], "checkoutRestricted": [],
            },
        },
        "allocations": allocations if allocations is not None else [allocation(2, [room()])],
    }}


def response(data, attribute=False):
    encoded = json.dumps(data)
    text = f'<div data-page="{html.escape(encoded, quote=True)}"></div>' if attribute else (
        f'<script data-page="app" type="application/json">{encoded}</script>'
    )
    return Mock(text=text)


class BuklyTests(unittest.TestCase):
    def setUp(self):
        self.network = patch.object(requests.Session, "send", side_effect=AssertionError("Live HTTP forbidden"))
        self.network.start()
        self.addCleanup(self.network.stop)

    @patch("hut_availability.checkers.bukly.http")
    def test_actual_root_allocations_not_empty_nested_default(self, http):
        http.return_value = response(payload())
        result = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0]
        self.assertEqual(result[1:3], ("available", None))
        self.assertEqual(json.loads(result[3])["people"], 2)
        self.assertEqual(json.loads(result[3])["count_type"], "yes_no")
        self.assertEqual(http.call_args.args, ("GET", "https://scotoni.bukly.com/booking"))
        self.assertNotIn("X-Inertia", str(http.call_args))

    def test_script_and_escaped_attribute_payloads(self):
        for attribute in (False, True):
            engine, allocations = page_payload(response(payload(), attribute).text)
            self.assertEqual(len(allocations), 1)
            self.assertEqual(engine["hotel"]["slug"], "scotoni")

    @patch("hut_availability.checkers.bukly.http")
    def test_all_three_hut_identities(self, http):
        for sub in ("scotoni", "rifugiocolgallina", "rifugioaverau"):
            http.return_value = response(payload(slug=sub))
            self.assertEqual(check_bukly(sub, {"sub": sub}, DAY, DAY, 2)[0][1], "available")

    @patch("hut_availability.checkers.bukly.http")
    def test_dates_guests_hut_and_confirmation_must_match(self, http):
        for target, key, value in [
            ("form", "checkin", "2027-07-01"), ("form", "rooms", "4"),
            ("form", "checkout", "2027-07-02"), ("form", "dateConfirmed", False),
            ("hotel", "slug", "another-hut"),
        ]:
            data = payload()
            data["props"]["bookingEngine"][target][key] = value
            http.return_value = response(data)
            with self.subTest(key=key), self.assertRaises(BuklyResponseError):
                check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)

    @patch("hut_availability.checkers.bukly.http")
    def test_empty_app_login_malformed_json_are_not_full(self, http):
        for text in ("<div id='app'></div>", "<html>Login</html>", '<script data-page>{bad}</script>'):
            http.return_value = Mock(text=text)
            with self.subTest(text=text), self.assertRaises(BuklyResponseError):
                check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)

    def test_missing_actual_allocations_is_not_empty_availability(self):
        data = payload()
        del data["props"]["allocations"]
        with self.assertRaises(BuklyResponseError):
            page_payload(response(data).text)

    def test_private_rooms_are_units_not_beds(self):
        # Live private-room quotes use total_guests=1, not the party's size.
        result, ambiguous = fit([allocation(4, [room(quantity=1, unit="room", adults=1)])])
        self.assertEqual(result, 4)
        self.assertFalse(ambiguous)

    def test_rate_plans_do_not_duplicate_a_physical_room(self):
        a = allocation(2, [room(quantity=1, unit="room", plan=1)])
        b = allocation(2, [room(quantity=1, unit="room", plan=2)])
        self.assertEqual(fit([a, b])[0], 2)  # Not 4 people in the same room.

    def test_separate_rooms_can_fit_the_whole_group(self):
        choices = [room(rid=1, quantity=1, unit="room"), room(rid=2, quantity=1, unit="room")]
        self.assertEqual(fit([allocation(2, choices), allocation(2, choices)])[0], 4)

    def test_bed_pool_consumes_people_not_rooms(self):
        self.assertEqual(fit([allocation(2, [room(quantity=3)]),
                              allocation(2, [room(quantity=3)])])[0], 2)

    def test_bad_or_incompatible_inventory_never_counts(self):
        self.assertEqual(fit([allocation(2, [room(unit="room", compatible=False)])]), (0, True))
        for quantity in (-1, True, 1.5, "3"):
            with self.subTest(quantity=quantity), self.assertRaises(BuklyResponseError):
                fit([allocation(2, [room(quantity=quantity)])])
        incomplete = room()
        del incomplete["ratePlans"][0]["minAvailability"]
        with self.assertRaises(BuklyResponseError):
            fit([allocation(2, [incomplete])])

    def test_live_bed_offer_can_be_bookable_despite_room_match_hint(self):
        self.assertEqual(fit([allocation(2, [room(compatible=False)])]), (2, False))

    @patch("hut_availability.checkers.bukly.http")
    def test_closed_calendar_shortcut_covers_range_and_crosses_month(self, http):
        data = payload(allocations=[])
        days = [DAY + timedelta(days=i) for i in range(7)]
        data["props"]["bookingEngine"]["calendarRestrictions"]["unavailableDates"] = list(map(str, days))
        http.return_value = response(data)
        rows = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, days[-1], 2)
        self.assertEqual([r[0] for r in rows], days)
        self.assertTrue(all(r[1] == "closed" for r in rows))
        self.assertEqual(http.call_count, 1)

    @patch("hut_availability.checkers.bukly.http")
    def test_outside_window_is_closed_not_full(self, http):
        data = payload(allocations=[])
        data["props"]["bookingEngine"]["calendarRestrictions"]["maxDate"] = "2027-06-01"
        http.return_value = response(data)
        result = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0]
        self.assertEqual(result[1], "closed")
        self.assertIn("not evidence of sold out", result[3])

    @patch("hut_availability.checkers.bukly.http")
    def test_all_layouts_empty_is_explicit_full_for_two(self, http):
        http.side_effect = lambda *args, **kw: response(payload(kw["params"], []))
        row = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0]
        self.assertEqual(row[1:3], ("full", 0))
        self.assertEqual(http.call_count, 2)
        self.assertEqual(http.call_args.kwargs["params"]["rooms"], "1|1")

    @patch("hut_availability.checkers.bukly.http")
    def test_partial_capacity_requires_all_group_partitions_checked(self, http):
        def search(*args, **kw):
            params = kw["params"]
            counts = list(map(int, params["rooms"].split("|")))
            result = [allocation(n, [room(quantity=1, adults=n, compatible=n == 1)]) for n in counts]
            return response(payload(params, result))
        http.side_effect = search
        row = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0]
        self.assertEqual(row[1:3], ("partial", 1))
        self.assertEqual(json.loads(row[3])["count_type"], "lower_bound")

    @patch("hut_availability.checkers.bukly.http")
    def test_untested_partitions_are_error_not_false_full(self, http):
        http.side_effect = lambda *args, **kw: response(payload(kw["params"], []))
        row = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 12)[0]
        self.assertEqual(row[1:3], ("error", None))
        self.assertEqual(http.call_count, 6)

    @patch("hut_availability.checkers.bukly.http")
    def test_split_layout_can_succeed_after_one_room_fails(self, http):
        def search(*args, **kw):
            params = kw["params"]
            allocations = [] if params["rooms"] == "4" else [
                allocation(2, [room(rid=1, quantity=2, unit="room")]),
                allocation(2, [room(rid=1, quantity=2, unit="room")]),
            ]
            return response(payload(params, allocations))
        http.side_effect = search
        row = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 4)[0]
        self.assertEqual(row[1:3], ("available", None))
        self.assertEqual(json.loads(row[3])["layout"], [2, 2])

    @patch("hut_availability.checkers.bukly.http")
    def test_checkout_restriction_is_not_claimed_as_sold_out_or_min_stay(self, http):
        data = payload(allocations=[])
        data["props"]["bookingEngine"]["calendarRestrictions"]["checkoutRestricted"] = ["2027-06-29"]
        http.return_value = response(data)
        self.assertEqual(check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0][1], "error")

    def test_layout_partitions_are_unique_and_complete_for_small_groups(self):
        self.assertEqual(len(layouts(4)), 5)
        for count in range(1, 13):
            found = layouts(count)
            self.assertEqual(len(found), len(set(found)))
            self.assertTrue(all(sum(x) == count for x in found))

    def test_legacy_rate_plans_deduplicate_and_private_capacity_not_default_one(self):
        def offer(title, unit, quantity):
            return f'<div class="hotel-room__sub"><div class="hotel-room__sub-title">{title}</div>Nr. {unit}<select name="data[Room][1]"><option value="0">0</option><option value="{quantity}">{quantity}</option></select></div>'
        text = offer("Double room half board", "rooms", 2) + offer("Double room B&B", "rooms", 2)
        row = legacy_result(text, DAY, 4, {})
        self.assertEqual(row[:2], ("available", 4))
        self.assertEqual(json.loads(row[2])["count_type"], "estimate")
        with self.assertRaises(BuklyResponseError):
            legacy_result(offer("Family room", "rooms", 2), DAY, 4, {})

    @patch("hut_availability.checkers.bukly.http")
    def test_legacy_fallback_only_on_404_not_denied_access(self, http):
        error = requests.HTTPError(response=Mock(status_code=403))
        http.side_effect = error
        with self.assertRaises(requests.HTTPError):
            check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)
        self.assertEqual(http.call_count, 1)

    @patch("hut_availability.checkers.bukly.http")
    def test_legacy_404_fallback_and_explicit_sold_out(self, http):
        http.side_effect = [
            requests.HTTPError(response=Mock(status_code=404)),
            Mock(text="<p>Sold out</p>"),
        ]
        row = check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)[0]
        self.assertEqual(row[1:3], ("full", 0))
        self.assertIn("/en-us/hotel/", http.call_args.args[1])

    @patch("hut_availability.checkers.bukly.http")
    def test_global_or_request_only_restrictions_are_not_available(self, http):
        for field in ("hotelRestrictions", "reservation_per_request"):
            data = payload()
            engine = data["props"]["bookingEngine"]
            if field == "hotelRestrictions":
                engine[field] = {"checkHotelHoursLimit": False}
            else:
                engine["hotel"][field] = 1
            http.return_value = response(data)
            with self.subTest(field=field), self.assertRaises(BuklyResponseError):
                check_bukly("Scotoni", {"sub": "scotoni"}, DAY, DAY, 2)

    def test_reject_nonpublic_subdomain_and_invalid_group(self):
        for cfg, people in [({"sub": "x/checkout"}, 2), ({"sub": "localhost:5001"}, 2), ({"sub": "scotoni"}, 13)]:
            with self.assertRaises(ValueError):
                check_bukly("test", cfg, DAY, DAY, people)


if __name__ == "__main__":
    unittest.main()
