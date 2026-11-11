import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, FlatList, StyleSheet,
  Platform, Alert, Modal, ScrollView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Web dùng localhost; điện thoại phải dùng IP LAN của máy tính
const HOST = Platform.OS === 'web' ? 'localhost' : '172.26.90.75';
const API = `http://${HOST}:5000/api`;

const C = {
  primary: '#047857', primary2: '#10b981', bg: '#f2f8f5', card: '#ffffff',
  text: '#16231d', sub: '#64748b', line: '#dcebe3',
  ok: '#0284c7', red: '#dc2626', amber: '#d97706',
};

const money = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
const EMPTY = { name: '', price: '', soluong: '', image: '' };

export default function App() {
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 800 ? 3 : 2;

  const [token, setToken] = useState(null);
  const [lg, setLg] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('new'); // new | price | stock

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState(EMPTY);

  const msg = (t) => (Platform.OS === 'web' ? window.alert(t) : Alert.alert('Thông báo', t));
  const confirmBox = (t, ok) => {
    if (Platform.OS === 'web') {
      if (window.confirm(t)) ok();
    } else {
      Alert.alert('Xác nhận', t, [{ text: 'Hủy' }, { text: 'Xóa', style: 'destructive', onPress: ok }]);
    }
  };

  const call = async (path, method = 'GET', body, tk = token) => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401 && tk) setToken(null);
      throw new Error(d.message || 'Có lỗi xảy ra');
    }
    return d;
  };

  const load = async (tk = token) => setProducts(await call('/products', 'GET', undefined, tk));

  const doLogin = async () => {
    try {
      setBusy(true);
      const d = await call('/login', 'POST', lg, null);
      await load(d.token);
      setToken(d.token);
    } catch (e) {
      msg(e.message === 'Network request failed' || e.message === 'Failed to fetch'
        ? 'Không kết nối được server' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => { setToken(null); setLg({ email: '', password: '' }); };

  const openForm = (p) => {
    setEditing(p);
    setF(p ? { name: p.name, price: String(p.price), soluong: String(p.soluong), image: p.image } : EMPTY);
    setModal(true);
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) return msg('Cần cấp quyền truy cập ảnh');
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
    });
    if (r.canceled) return;
    const a = r.assets[0];
    setF({ ...f, image: a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri });
  };

  const save = async () => {
    if (!f.name.trim()) return msg('Vui lòng nhập tên sản phẩm');
    if (f.price === '' || isNaN(Number(f.price)) || Number(f.price) < 0) return msg('Giá phải là số không âm');
    if (!/^\d+$/.test(f.soluong)) return msg('Số lượng phải là số nguyên không âm');
    try {
      setBusy(true);
      const body = { name: f.name, price: Number(f.price), soluong: Number(f.soluong), image: f.image };
      await call(editing ? `/products/${editing._id}` : '/products', editing ? 'PUT' : 'POST', body);
      await load();
      setModal(false);
    } catch (e) {
      msg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (p) =>
    confirmBox(`Xóa sản phẩm "${p.name}"?`, async () => {
      try { await call(`/products/${p._id}`, 'DELETE'); await load(); } catch (e) { msg(e.message); }
    });

  // ----- Thống kê và danh sách hiển thị -----
  const stats = useMemo(() => ({
    count: products.length,
    stock: products.reduce((s, p) => s + p.soluong, 0),
    value: products.reduce((s, p) => s + p.price * p.soluong, 0),
  }), [products]);

  const shown = useMemo(() => {
    let l = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase().trim()));
    if (sort === 'price') l = [...l].sort((a, b) => b.price - a.price);
    if (sort === 'stock') l = [...l].sort((a, b) => a.soluong - b.soluong);
    const out = [...l];
    while (out.length % cols !== 0) out.push({ _id: `empty${out.length}`, _empty: true });
    return out;
  }, [products, search, sort, cols]);

  // ================= MÀN HÌNH ĐĂNG NHẬP =================
  if (!token) {
    return (
      <LinearGradient colors={[C.primary, C.primary2]} style={s.loginBg}>
        <View style={s.loginCard}>
          <View style={s.logo}><Ionicons name="storefront" size={34} color="#fff" /></View>
          <Text style={s.loginTitle}>Quản lý sản phẩm</Text>
          <Text style={s.loginSub}>Đăng nhập tài khoản quản trị</Text>

          <View style={s.inputRow}>
            <Ionicons name="mail-outline" size={20} color={C.sub} />
            <TextInput style={s.inputFlex} placeholder="Email" autoCapitalize="none"
              keyboardType="email-address" value={lg.email}
              onChangeText={(t) => setLg({ ...lg, email: t })} />
          </View>
          <View style={s.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={C.sub} />
            <TextInput style={s.inputFlex} placeholder="Mật khẩu" secureTextEntry={!showPw}
              value={lg.password} onChangeText={(t) => setLg({ ...lg, password: t })}
              onSubmitEditing={doLogin} />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.sub} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={doLogin} disabled={busy} activeOpacity={0.85}>
            <LinearGradient colors={[C.primary, C.primary2]} style={s.loginBtn}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Đăng nhập</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ================= MÀN HÌNH CHÍNH =================
  return (
    <View style={s.page}>
      <LinearGradient colors={[C.primary, C.primary2]} style={s.header}>
        <View style={s.inner}>
          <View style={s.headRow}>
            <View>
              <Text style={s.headHi}>Xin chào, Admin 👋</Text>
              <Text style={s.headTitle}>Quản lý sản phẩm</Text>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={s.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
          <View style={s.statRow}>
            <Stat icon="cube-outline" label="Sản phẩm" value={String(stats.count)} />
            <Stat icon="layers-outline" label="Tồn kho" value={String(stats.stock)} />
            <Stat icon="cash-outline" label="Giá trị kho" value={money(stats.value)} />
          </View>
        </View>
      </LinearGradient>

      <View style={[s.inner, { flex: 1 }]}>
        <View style={s.toolbar}>
          <View style={[s.inputRow, { flex: 1, marginBottom: 0 }]}>
            <Ionicons name="search-outline" size={20} color={C.sub} />
            <TextInput style={s.inputFlex} placeholder="Tìm sản phẩm theo tên..."
              value={search} onChangeText={setSearch} />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={C.sub} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={s.chips}>
          {[['new', 'Mới nhất'], ['price', 'Giá cao'], ['stock', 'Tồn thấp']].map(([k, label]) => (
            <TouchableOpacity key={k} onPress={() => setSort(k)}
              style={[s.chip, sort === k && s.chipOn]}>
              <Text style={[s.chipText, sort === k && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          key={cols}
          data={shown}
          numColumns={cols}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={54} color="#b6cfc3" />
              <Text style={s.emptyText}>Chưa có sản phẩm nào</Text>
              <Text style={{ color: C.sub }}>Bấm nút + để thêm sản phẩm đầu tiên</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item._empty) return <View style={{ flex: 1, margin: 6 }} />;
            const out = item.soluong === 0;
            const low = item.soluong > 0 && item.soluong <= 5;
            return (
              <View style={s.card}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.img} />
                ) : (
                  <View style={[s.img, s.imgEmpty]}><Ionicons name="image-outline" size={40} color="#b6cfc3" /></View>
                )}
                <View style={[s.badge, { backgroundColor: out ? C.red : low ? C.amber : C.ok }]}>
                  <Text style={s.badgeText}>{out ? 'Hết hàng' : low ? 'Sắp hết' : 'Còn hàng'}</Text>
                </View>
                <View style={{ padding: 12 }}>
                  <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                  <Text style={s.price}>{money(item.price)}</Text>
                  <Text style={s.qty}>Số lượng: {item.soluong}</Text>
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.act, { backgroundColor: '#ecfdf5' }]} onPress={() => openForm(item)}>
                      <Ionicons name="create-outline" size={16} color={C.primary} />
                      <Text style={[s.actText, { color: C.primary }]}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.act, { backgroundColor: '#fef2f2' }]} onPress={() => remove(item)}>
                      <Ionicons name="trash-outline" size={16} color={C.red} />
                      <Text style={[s.actText, { color: C.red }]}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* Nút thêm nổi */}
      <TouchableOpacity style={s.fab} onPress={() => openForm(null)} activeOpacity={0.85}>
        <LinearGradient colors={[C.primary, C.primary2]} style={s.fabIn}>
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Form thêm / sửa */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={26} color={C.sub} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={{ alignSelf: 'center' }}>
                {f.image ? (
                  <Image source={{ uri: f.image }} style={s.pickImg} />
                ) : (
                  <View style={[s.pickImg, s.pickEmpty]}>
                    <Ionicons name="camera-outline" size={34} color={C.primary} />
                    <Text style={{ color: C.primary, marginTop: 4 }}>Chọn hình ảnh</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={s.label}>Tên sản phẩm</Text>
              <TextInput style={s.input} placeholder="VD: Áo thun nam" value={f.name}
                onChangeText={(t) => setF({ ...f, name: t })} />
              <Text style={s.label}>Giá (₫)</Text>
              <TextInput style={s.input} placeholder="VD: 150000" keyboardType="numeric" value={f.price}
                onChangeText={(t) => setF({ ...f, price: t.replace(/[^0-9.]/g, '') })} />
              <Text style={s.label}>Số lượng</Text>
              <TextInput style={s.input} placeholder="VD: 20" keyboardType="numeric" value={f.soluong}
                onChangeText={(t) => setF({ ...f, soluong: t.replace(/[^0-9]/g, '') })} />

              <TouchableOpacity onPress={save} disabled={busy} activeOpacity={0.85} style={{ marginTop: 8 }}>
                <LinearGradient colors={[C.primary, C.primary2]} style={s.loginBtn}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Lưu sản phẩm</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const shadow = {
  shadowColor: '#064e3b', shadowOpacity: 0.08, shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 }, elevation: 3,
};

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  inner: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 16 },

  loginBg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 24, padding: 28, ...shadow },
  logo: { width: 68, height: 68, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  loginTitle: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center' },
  loginSub: { color: C.sub, textAlign: 'center', marginBottom: 22, marginTop: 4 },
  loginBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 },
  inputFlex: { flex: 1, paddingVertical: 13, fontSize: 15, color: C.text, outlineStyle: 'none' },

  header: { paddingTop: Platform.OS === 'web' ? 24 : 54, paddingBottom: 22 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headHi: { color: '#d1fae5', fontSize: 14 },
  headTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  logoutText: { color: '#fff', fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 12 },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 6 },
  statLabel: { color: '#d1fae5', fontSize: 12 },

  toolbar: { flexDirection: 'row', marginTop: 16 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontWeight: '600', fontSize: 13 },

  card: { flex: 1, margin: 6, backgroundColor: C.card, borderRadius: 18, overflow: 'hidden', ...shadow },
  img: { width: '100%', aspectRatio: 1, backgroundColor: '#e8f1ec' },
  imgEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: C.text, minHeight: 38 },
  price: { fontSize: 17, fontWeight: '800', color: C.primary, marginTop: 4 },
  qty: { color: C.sub, marginTop: 2, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  act: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10 },
  actText: { fontWeight: '700', fontSize: 13 },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 17, fontWeight: '700', color: C.text, marginTop: 10 },

  fab: { position: 'absolute', right: 22, bottom: 26, ...shadow },
  fabIn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  pickImg: { width: 130, height: 130, borderRadius: 20, marginBottom: 6 },
  pickEmpty: { backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#a7f3d0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', color: C.text, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, backgroundColor: '#f7fcf9' },
});