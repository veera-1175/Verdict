import type { PasswordChangeRequest } from "../lib/api";

interface Props {
  requests: PasswordChangeRequest[];
  loading: boolean;
  acting: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function PasswordRequestsPanel({
  requests,
  loading,
  acting,
  onApprove,
  onReject,
}: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin border-2 border-ink-800 border-t-white" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="panel px-6 py-10 text-center text-sm text-ink-500">
        No pending password change requests.
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-ink-800 px-6 py-4">
        <p className="mono-label">Password change requests</p>
        <p className="mt-1 text-xs text-ink-500">
          Approve to apply the new password.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink-800 bg-ink-900">
          <tr>
            <th className="mono-label px-6 py-3">Requested</th>
            <th className="mono-label px-6 py-3">Developer</th>
            <th className="mono-label px-6 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-b border-ink-900">
              <td className="px-6 py-4 text-ink-300">{new Date(req.created_at).toLocaleString()}</td>
              <td className="px-6 py-4">
                <p className="text-white">{req.user_name || req.user_email}</p>
                <p className="text-xs text-ink-500">{req.user_email}</p>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={acting === req.id}
                    onClick={() => onApprove(req.id)}
                    className="btn-ink text-xs"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={acting === req.id}
                    onClick={() => onReject(req.id)}
                    className="btn-ghost text-xs"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
