import pytest
import math
from datetime import datetime, timezone
from app.utils.parse_timestamp import parse_timestamp, normalize_to_iso_string

class TestParseTimestamp:
    @pytest.fixture
    def date_2023(self):
        return datetime(2023, 10, 26, 10, 0, 0, tzinfo=timezone.utc)
    
    @pytest.fixture
    def seconds_timestamp(self, date_2023):
        return int(date_2023.timestamp())  # 1698314400
    
    @pytest.fixture 
    def millis_timestamp(self, date_2023):
        return int(date_2023.timestamp() * 1000)  # 1698314400000

    # --- Valid Inputs ---
    def test_should_parse_a_valid_unix_timestamp_seconds(self, seconds_timestamp, date_2023):
        result = parse_timestamp(seconds_timestamp)
        assert result == date_2023

    def test_should_parse_a_valid_unix_timestamp_milliseconds(self, millis_timestamp, date_2023):
        result = parse_timestamp(millis_timestamp)
        assert result == date_2023

    def test_should_parse_a_valid_iso_8601_string_with_z_timezone(self, date_2023):
        result = parse_timestamp('2023-10-26T10:00:00.000Z')
        assert result == date_2023

    def test_should_parse_a_valid_iso_8601_string_with_offset(self):
        result = parse_timestamp('2023-10-26T12:00:00.000+02:00')
        assert result.isoformat() == '2023-10-26T10:00:00+00:00'  # Should adjust to UTC

    def test_should_parse_a_valid_iso_8601_string_without_milliseconds(self, date_2023):
        result = parse_timestamp('2023-10-26T10:00:00Z')
        # Compare without microseconds since our test date has 0 microseconds
        expected = date_2023.replace(microsecond=0)
        assert result.replace(microsecond=0) == expected

    def test_should_parse_a_valid_sql_like_timestamp_string(self):
        result = parse_timestamp('2023-10-26 10:00:00')
        assert result is not None
        assert result.year == 2023
        assert result.month == 10
        assert result.day == 26
        # Hours can vary depending on timezone handling, so we test components

    def test_should_parse_a_valid_date_string(self):
        result = parse_timestamp('2023-10-26')
        assert result is not None
        assert result.year == 2023
        assert result.month == 10
        assert result.day == 26

    def test_should_parse_timestamp_for_epoch_0_seconds(self):
        result = parse_timestamp(0)
        assert result == datetime(1970, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    def test_should_handle_datetime_objects(self):
        dt = datetime(2023, 10, 26, 10, 0, 0, tzinfo=timezone.utc)
        result = parse_timestamp(dt)
        assert result == dt

    def test_should_handle_naive_datetime_objects(self):
        dt_naive = datetime(2023, 10, 26, 10, 0, 0)
        result = parse_timestamp(dt_naive)
        expected = dt_naive.replace(tzinfo=timezone.utc)
        assert result == expected

    # --- Invalid Inputs ---
    def test_should_return_none_for_null_input(self):
        assert parse_timestamp(None) is None

    def test_should_return_none_for_undefined_input(self):
        # Python doesn't have undefined, but we can test with None
        assert parse_timestamp(None) is None

    def test_should_return_none_for_an_empty_string(self):
        assert parse_timestamp('') is None

    def test_should_return_none_for_a_whitespace_string(self):
        assert parse_timestamp('   ') is None

    def test_should_return_none_for_an_invalid_date_string(self):
        assert parse_timestamp('not a valid date') is None

    def test_should_return_none_for_a_completely_invalid_format(self):
        assert parse_timestamp('invalid-format') is None

    def test_should_return_none_for_nan_number(self):
        assert parse_timestamp(float('nan')) is None

    def test_should_return_none_for_invalid_types(self):
        assert parse_timestamp(True) is None
        assert parse_timestamp(False) is None
        assert parse_timestamp({}) is None
        assert parse_timestamp({'date': '2023-01-01'}) is None

    def test_should_handle_float_timestamps(self):
        # Test with float seconds
        timestamp_float = 1698314400.5  # Half second
        result = parse_timestamp(timestamp_float)
        assert result is not None
        assert result.microsecond == 500000  # 0.5 seconds = 500000 microseconds

class TestNormalizeToIsoString:
    def test_should_convert_valid_timestamp_to_iso_string(self):
        result = normalize_to_iso_string('2023-10-26T10:00:00.000Z')
        assert result == '2023-10-26T10:00:00.000Z'

    def test_should_convert_datetime_to_iso_string(self):
        dt = datetime(2023, 10, 26, 10, 0, 0, tzinfo=timezone.utc)
        result = normalize_to_iso_string(dt)
        assert result == '2023-10-26T10:00:00.000Z'

    def test_should_convert_unix_timestamp_to_iso_string(self):
        result = normalize_to_iso_string(1698314400)  # seconds
        assert result == '2023-10-26T10:00:00.000Z'

    def test_should_return_none_for_invalid_input(self):
        assert normalize_to_iso_string('invalid') is None
        assert normalize_to_iso_string(None) is None

    def test_should_handle_offset_timezone_and_convert_to_z(self):
        result = normalize_to_iso_string('2023-10-26T12:00:00.000+02:00')
        assert result == '2023-10-26T10:00:00.000Z'  # Converted to UTC

    def test_should_handle_naive_datetime_and_assume_utc(self):
        dt_naive = datetime(2023, 10, 26, 10, 0, 0)
        result = normalize_to_iso_string(dt_naive)
        assert result == '2023-10-26T10:00:00.000Z' 