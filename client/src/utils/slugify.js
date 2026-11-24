// Bỏ dấu tiếng Việt, chữ thường, chỉ giữ a-z, 0-9 và dấu gạch ngang.
export const slugify = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
