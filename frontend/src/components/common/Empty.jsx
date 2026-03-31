export default function Empty({ message = 'Không có dữ liệu', action }) {
  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <div className="text-6xl mb-4">📭</div>
      <h3 className="text-xl font-semibold text-gray-600 mb-2">Trống</h3>
      <p className="text-gray-500 mb-6">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
