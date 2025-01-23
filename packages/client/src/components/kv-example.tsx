import React, { useState } from 'react';
import { useGetKvValue, useSetKvValue } from '@/hooks/api/use-kv-api';
import { KVKeyEnum } from 'shared/src/kv-validators';

export function KvExample() {
  // Fetch current userProfile from KV
  const { data: userProfile, isLoading } = useGetKvValue(KVKeyEnum.userProfile);
  const { mutateAsync: setUserProfile } = useSetKvValue(KVKeyEnum.userProfile);

  const [name, setName] = useState(userProfile?.name ?? '');
  const [age, setAge] = useState(userProfile?.age ?? 0);

  if (isLoading) {
    return <div>Loading user profile...</div>;
  }

  // Save profile to KV store
  async function handleSave() {
    // This will be validated on the client (in effect, by the route) and again on the server
    await setUserProfile({
      newValue: { name, age },
    });
    // Optionally refetch or rely on auto invalidation
  }

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <h2 className="text-xl font-semibold mb-4">KV Example: User Profile</h2>
      <div className="space-y-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700">User Name:</label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700">Age:</label>
          <input
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            type="number"
            value={age}
            onChange={e => setAge(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <button
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onClick={handleSave}
        >
          Save to KV
        </button>

        {userProfile && (
          <div className="mt-4">
            <h4 className="text-lg font-medium text-gray-900">Current Stored Profile:</h4>
            <pre className="mt-2 bg-gray-50 p-4 rounded-md overflow-auto">
              {JSON.stringify(userProfile, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 