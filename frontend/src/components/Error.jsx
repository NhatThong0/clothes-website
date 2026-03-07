export default function Error({ message = 'Đã có lỗi xảy ra', onRetry }) {
  return (
    <div className="max-w-md mx-auto py-12 text-center">
      <div className="text-6xl mb-4">⚠️</div>
      <h3 className="text-xl font-semibold text-red-600 mb-2">Lỗi</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-all"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
