import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { demoComparisonFields, demoProducts } from './demo-products.js';

const defaultProductIds = ['sample-a', 'sample-b'];
const scopes = [
  { id: 'default', label: 'Giá, hiệu năng, nhu cầu', fields: ['price', 'performance', 'usage'] },
  { id: 'price', label: 'Chỉ giá', fields: ['price'] },
  { id: 'performance', label: 'Chỉ hiệu năng', fields: ['performance'] },
  { id: 'usage', label: 'Chỉ nhu cầu sử dụng', fields: ['usage'] },
  { id: 'warranty', label: 'Chỉ bảo hành', fields: ['warranty'] },
];

// Bảng mẫu chỉ dùng bốn sản phẩm giả định cùng loại để duyệt bố cục và thao tác chọn 2–4 cột.
export default function ComparisonPreview({ initialScope = 'default' }) {
  const [productIds, setProductIds] = useState(defaultProductIds);
  const [scopeId, setScopeId] = useState(initialScope);
  const scope = scopes.find(item => item.id === scopeId) || scopes[0];
  const fields = demoComparisonFields.filter(field => scope.fields.includes(field.id));
  const selectedProducts = productIds.map(id => demoProducts.find(product => product.id === id));

  function changeProduct(index, value) {
    if (productIds.some((id, position) => id === value && position !== index)) return;
    setProductIds(current => current.map((id, position) => position === index ? value : id));
  }

  function addProduct() {
    const next = demoProducts.find(product => !productIds.includes(product.id));
    if (next && productIds.length < 4) setProductIds(current => [...current, next.id]);
  }

  return <section className="hc-chatbot-comparison" aria-label="Bảng so sánh sản phẩm minh họa">
    <div className="hc-chatbot-comparison-head"><div><strong>So sánh 2–4 sản phẩm cùng loại</strong><p>Máy giặt · dữ liệu mẫu, không phải giá bán hiện tại.</p></div><button type="button" onClick={addProduct} disabled={productIds.length >= 4}><Plus size={15} aria-hidden="true" /> Thêm sản phẩm</button></div>
    <label className="hc-chatbot-scope" htmlFor="chatbot-comparison-scope">Tiêu chí muốn so sánh <select id="chatbot-comparison-scope" value={scopeId} onChange={event => setScopeId(event.target.value)}>{scopes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div className="hc-chatbot-table-scroll"><table className="hc-chatbot-table"><thead><tr><th scope="col">Tiêu chí</th>{selectedProducts.map((product, index) => <th scope="col" key={product.id}><label htmlFor={`chatbot-product-${index}`}>Sản phẩm {index + 1}</label><div className="hc-chatbot-product-choice"><select id={`chatbot-product-${index}`} value={product.id} onChange={event => changeProduct(index, event.target.value)}>{demoProducts.map(candidate => <option key={candidate.id} value={candidate.id} disabled={productIds.includes(candidate.id) && candidate.id !== product.id}>{candidate.name}</option>)}</select>{productIds.length > 2 && <button type="button" aria-label={`Bỏ sản phẩm ${index + 1}`} onClick={() => setProductIds(current => current.filter((_, position) => position !== index))}><Trash2 size={14} aria-hidden="true" /></button>}</div></th>)}</tr></thead><tbody>{fields.map(field => <tr key={field.id}><th scope="row">{field.label}</th>{selectedProducts.map(product => <td key={product.id}>{field.display(product)}</td>)}</tr>)}</tbody></table></div>
    <p className="hc-chatbot-source">Khi tích hợp, mọi giá và thông số sẽ lấy từ catalog đang hoạt động; dữ liệu thiếu hiển thị “Chưa có dữ liệu”.</p>
  </section>;
}
