from hut_availability.checkers.bukly import check_bukly
from hut_availability.checkers.dibona_app import check_dibona_app
from hut_availability.checkers.foundation import check_foundation
from hut_availability.checkers.suedtirol import check_suedtirol

CHECKERS = {
    "foundation": check_foundation,
    "bukly": check_bukly,
    "suedtirol": check_suedtirol,
    "dibona_app": check_dibona_app,
}
