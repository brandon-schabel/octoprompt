import pytest
from app.utils.merge_deep import merge_deep

class TestMergeDeep:
    def test_should_merge_two_flat_objects(self):
        obj1 = {'a': 1}
        obj2 = {'b': 2}
        result = merge_deep(obj1, obj2)
        assert result == {'a': 1, 'b': 2}

    def test_should_override_properties_with_later_objects(self):
        obj1 = {'a': 1, 'b': 2}
        obj2 = {'a': 42}
        result = merge_deep(obj1, obj2)
        assert result == {'a': 42, 'b': 2}

    def test_should_merge_nested_objects(self):
        obj1 = {'a': {'b': 1}}
        obj2 = {'a': {'c': 2}}
        result = merge_deep(obj1, obj2)
        assert result == {'a': {'b': 1, 'c': 2}}

    def test_should_override_nested_objects_completely_if_a_non_object_is_provided(self):
        obj1 = {'a': {'b': 1}}
        obj2 = {'a': 2}
        result = merge_deep(obj1, obj2)
        assert result == {'a': 2}

    def test_should_merge_multiple_objects(self):
        obj1 = {'a': 1, 'nested': {'x': 10}}
        obj2 = {'b': 2, 'nested': {'y': 20}}
        obj3 = {'c': 3, 'nested': {'z': 30}}
        result = merge_deep(obj1, obj2, obj3)
        assert result == {
            'a': 1,
            'b': 2,
            'c': 3,
            'nested': {'x': 10, 'y': 20, 'z': 30}
        }

    def test_should_handle_arrays_by_overwriting_them(self):
        obj1 = {'a': [1, 2, 3]}
        obj2 = {'a': [4, 5]}
        result = merge_deep(obj1, obj2)
        assert result == {'a': [4, 5]}

    def test_should_not_mutate_the_original_objects(self):
        obj1 = {'a': 1, 'nested': {'b': 2}}
        obj2 = {'nested': {'c': 3}}
        import copy
        clone1 = copy.deepcopy(obj1)
        clone2 = copy.deepcopy(obj2)
        result = merge_deep(obj1, obj2)
        assert obj1 == clone1
        assert obj2 == clone2

    def test_should_skip_non_object_inputs_gracefully(self):
        obj1 = {'a': 1}
        # Passing None should be ignored in the merge
        result = merge_deep(obj1, None, {'b': 2})
        assert result == {'a': 1, 'b': 2}

    def test_should_merge_correctly_when_one_of_the_objects_is_empty(self):
        obj1 = {'a': 1}
        obj2 = {}
        result = merge_deep(obj1, obj2)
        assert result == {'a': 1}

    def test_should_return_an_empty_object_if_no_arguments_are_provided(self):
        result = merge_deep()
        assert result == {}

    def test_should_handle_string_and_number_inputs_gracefully(self):
        obj1 = {'a': 1}
        result = merge_deep(obj1, 'not_a_dict', 42, {'b': 2})
        assert result == {'a': 1, 'b': 2}

    def test_should_handle_nested_dicts_with_empty_values(self):
        obj1 = {'a': {'b': None}}
        obj2 = {'a': {'c': 'value'}}
        result = merge_deep(obj1, obj2)
        assert result == {'a': {'b': None, 'c': 'value'}}

    def test_should_deeply_merge_three_levels(self):
        obj1 = {'level1': {'level2': {'level3': 'value1'}}}
        obj2 = {'level1': {'level2': {'level3_new': 'value2'}}}
        result = merge_deep(obj1, obj2)
        assert result == {'level1': {'level2': {'level3': 'value1', 'level3_new': 'value2'}}} 