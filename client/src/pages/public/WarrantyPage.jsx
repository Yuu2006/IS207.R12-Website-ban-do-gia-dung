import { ClipboardList, PackageCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

// Hướng dẫn tra cứu thông tin thật; không giả lập đăng ký hoặc tiếp nhận sửa chữa.
export default function WarrantyPage() {
  return <main className="min-h-[65vh] bg-[#F7F8FA] px-4 py-10 sm:py-14">
    <div className="mx-auto max-w-5xl">
      <nav aria-label="Đường dẫn" className="mb-8 flex gap-2 text-sm text-[#667085]">
        <Link to="/" className="hover:text-[#0F5F73]">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Bảo hành</span>
      </nav>
      <div className="max-w-2xl">
        <ShieldCheck size={32} className="mb-4 text-[#0F5F73]" aria-hidden="true" />
        <h1 className="text-3xl font-bold tracking-tight text-[#1F2937] sm:text-4xl">Thông tin bảo hành</h1>
        <p className="mt-4 leading-7 text-[#667085]">Tìm thông tin sản phẩm đã mua và chuẩn bị các giấy tờ cần thiết khi liên hệ bảo hành.</p>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <section id="lookup" aria-labelledby="warranty-lookup" className="rounded-lg border border-[#E5E7EB] bg-white p-6 sm:p-8">
          <PackageCheck size={24} className="mb-4 text-[#0F5F73]" aria-hidden="true" />
          <h2 id="warranty-lookup" className="text-xl font-semibold text-[#1F2937]">Xem sản phẩm đã mua</h2>
          <p className="mt-3 leading-7 text-[#667085]">Đăng nhập để mở đơn hàng của bạn, xem sản phẩm, ngày đặt và thời hạn bảo hành đã lưu tại thời điểm mua.</p>
          <Link to="/orders" className="mt-6 inline-flex rounded-md bg-[#0F5F73] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B4E60] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0F5F73]">Xem đơn hàng của tôi</Link>
        </section>
        <section id="prepare" aria-labelledby="warranty-prepare" className="rounded-lg border border-[#E5E7EB] bg-white p-6 sm:p-8">
          <ClipboardList size={24} className="mb-4 text-[#0F5F73]" aria-hidden="true" />
          <h2 id="warranty-prepare" className="text-xl font-semibold text-[#1F2937]">Thông tin cần chuẩn bị</h2>
          <ul className="mt-3 list-disc space-y-3 pl-5 leading-7 text-[#667085]">
            <li>Mã đơn hàng hoặc chứng từ mua hàng.</li>
            <li>Tên, model sản phẩm và số serial nếu có.</li>
            <li>Phiếu bảo hành và mô tả tình trạng sản phẩm.</li>
          </ul>
        </section>
      </div>
      <section aria-labelledby="warranty-terms" className="mt-5 rounded-lg border border-[#E5E7EB] bg-white p-6 sm:p-8">
        <h2 id="warranty-terms" className="text-xl font-semibold text-[#1F2937]">Thời hạn và điều kiện bảo hành</h2>
        <p className="mt-3 leading-7 text-[#667085]">Thông tin bảo hành tùy thuộc từng sản phẩm và chính sách của nhà sản xuất. Đối chiếu thông tin trên đơn hàng, phiếu bảo hành và hướng dẫn đi kèm trước khi liên hệ đơn vị bảo hành.</p>
        <Link to="/products" className="mt-4 inline-flex text-sm font-semibold text-[#0F5F73] underline-offset-4 hover:underline">Xem thông tin sản phẩm</Link>
      </section>
    </div>
  </main>;
}
