import pytest
import math
from datetime import datetime, timezone
from app.utils.storage_timestap_utils import (
    convert_timestamp_to_ms_int, convert_id_to_int, convert_optional_id_to_int
)

class TestConvertTimestampToMsInt:
    def test_should_handle_none_input(self):
        result = convert_timestamp_to_ms_int(None)
        assert result is None

    def test_should_convert_iso_string_with_z_suffix(self):
        iso_string = '2023-10-26T10:00:00.000Z'
        result = convert_timestamp_to_ms_int(iso_string)
        # 2023-10-26T10:00:00.000Z should convert to 1698314400000 milliseconds
        assert isinstance(result, int)
        assert result == 1698314400000

    def test_should_convert_iso_string_with_offset(self):
        iso_string = '2023-10-26T12:00:00.000+02:00'
        result = convert_timestamp_to_ms_int(iso_string)
        # Should convert to UTC equivalent (10:00:00 UTC)
        assert isinstance(result, int)
        assert result == 1698314400000

    def test_should_convert_iso_string_without_milliseconds(self):
        iso_string = '2023-10-26T10:00:00Z'
        result = convert_timestamp_to_ms_int(iso_string)
        assert isinstance(result, int)
        assert result == 1698314400000

    def test_should_handle_integer_input(self):
        ms_timestamp = 1698314400000
        result = convert_timestamp_to_ms_int(ms_timestamp)
        assert result == ms_timestamp

    def test_should_handle_float_input(self):
        ms_timestamp_float = 1698314400000.5
        result = convert_timestamp_to_ms_int(ms_timestamp_float)
        assert result == 1698314400000  # Should truncate to int

    def test_should_handle_datetime_object_with_timezone(self):
        dt = datetime(2023, 10, 26, 10, 0, 0, tzinfo=timezone.utc)
        result = convert_timestamp_to_ms_int(dt)
        assert result == 1698314400000

    def test_should_handle_naive_datetime_object(self):
        dt_naive = datetime(2023, 10, 26, 10, 0, 0)
        result = convert_timestamp_to_ms_int(dt_naive)
        # Should assume UTC for naive datetime
        assert isinstance(result, int)

    def test_should_raise_error_for_nan_float(self):
        with pytest.raises(ValueError, match="NaN is not a valid timestamp value"):
            convert_timestamp_to_ms_int(float('nan'))

    def test_should_raise_error_for_invalid_string_format(self):
        with pytest.raises(ValueError, match="Invalid timestamp string format"):
            convert_timestamp_to_ms_int('invalid-date-string')

    def test_should_raise_error_for_invalid_type(self):
        with pytest.raises(TypeError, match="Timestamp for conversion to ms int must be"):
            convert_timestamp_to_ms_int(['invalid', 'type'])

    def test_should_raise_error_for_boolean_input(self):
        with pytest.raises(TypeError, match="Timestamp for conversion to ms int must be"):
            convert_timestamp_to_ms_int(True)

class TestConvertIdToInt:
    def test_should_convert_integer_input(self):
        result = convert_id_to_int(123)
        assert result == 123
        assert isinstance(result, int)

    def test_should_convert_float_input(self):
        result = convert_id_to_int(123.7)
        assert result == 123
        assert isinstance(result, int)

    def test_should_convert_valid_string_input(self):
        result = convert_id_to_int('456')
        assert result == 456
        assert isinstance(result, int)

    def test_should_convert_string_with_leading_zeros(self):
        result = convert_id_to_int('0123')
        assert result == 123

    def test_should_raise_error_for_nan_float(self):
        with pytest.raises(TypeError, match="ID must be a valid number, not NaN"):
            convert_id_to_int(float('nan'))

    def test_should_raise_error_for_invalid_string(self):
        with pytest.raises(ValueError, match="ID string 'abc' is not a valid integer"):
            convert_id_to_int('abc')

    def test_should_raise_error_for_empty_string(self):
        with pytest.raises(ValueError, match="ID string '' is not a valid integer"):
            convert_id_to_int('')

    def test_should_raise_error_for_invalid_type(self):
        with pytest.raises(TypeError, match="ID must be an integer, float, or a string"):
            convert_id_to_int(['not', 'valid'])

    def test_should_raise_error_for_none_input(self):
        with pytest.raises(TypeError, match="ID must be an integer, float, or a string"):
            convert_id_to_int(None)

    def test_should_handle_zero(self):
        result = convert_id_to_int(0)
        assert result == 0

    def test_should_handle_negative_numbers(self):
        result = convert_id_to_int(-123)
        assert result == -123

class TestConvertOptionalIdToInt:
    def test_should_handle_none_input(self):
        result = convert_optional_id_to_int(None)
        assert result is None

    def test_should_convert_valid_integer(self):
        result = convert_optional_id_to_int(123)
        assert result == 123

    def test_should_convert_valid_string(self):
        result = convert_optional_id_to_int('456')
        assert result == 456

    def test_should_convert_valid_float(self):
        result = convert_optional_id_to_int(789.5)
        assert result == 789

    def test_should_raise_error_for_invalid_string(self):
        with pytest.raises(ValueError, match="ID string 'invalid' is not a valid integer"):
            convert_optional_id_to_int('invalid')

    def test_should_raise_error_for_nan_float(self):
        with pytest.raises(TypeError, match="ID must be a valid number, not NaN"):
            convert_optional_id_to_int(float('nan'))

    def test_should_raise_error_for_invalid_type(self):
        with pytest.raises(TypeError, match="ID must be an integer, float, or a string"):
            convert_optional_id_to_int({'not': 'valid'})

class TestTimestampUtils:
    def test_should_handle_edge_case_timestamps(self):
        # Test epoch timestamp
        epoch_result = convert_timestamp_to_ms_int(0)
        assert epoch_result == 0

        # Test far future timestamp
        future_timestamp = 4102444800000  # Year 2100
        future_result = convert_timestamp_to_ms_int(future_timestamp)
        assert future_result == future_timestamp

    def test_should_maintain_precision_for_milliseconds(self):
        # Test that millisecond precision is maintained
        ms_with_precision = 1698314400123
        result = convert_timestamp_to_ms_int(ms_with_precision)
        assert result == ms_with_precision

    def test_should_handle_string_numbers_for_ids(self):
        # Test string representation of large numbers
        large_id_str = '9223372036854775807'  # Max int64
        result = convert_id_to_int(large_id_str)
        assert result == 9223372036854775807 