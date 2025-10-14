import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const KIDS = Array.from({ length: 24 }).map((_, i) => ({
  id: i + 1,
  nome: `Criança ${i + 1}`,
  idade: 5 + ((i * 7) % 8),
  descricao: "Gosta de brincar, desenhar e ouvir histórias.",
}));

export default function App() {
  const [aberta, setAberta] = useState(null);
  const [contagem, setContagem] = useState({});
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("padrinhos")
        .select("kid_id")
        .neq("status", "cancelado");
      if (error) return;
      const c = {};
      data.forEach((r) => (c[r.kid_id] = (c[r.kid_id] || 0) + 1));
      setContagem(c);
    })();
  }, []);

  const abrir = (kid) => {
    setAberta(kid);
    setNome(""); setEmail(""); setTel(""); setMsg("");
    setErro(""); setOk("");
  };

  const fechar = () => setAberta(null);

  async function enviar(e) {
    e.preventDefault();
    setErro(""); setOk("");
    if (!aberta) return;
    if (!nome.trim() || !email.trim()) {
      setErro("Nome e e-mail são obrigatórios.");
      return;
    }
    const atual = contagem[aberta.id] || 0;
    if (atual >= 4) {
      setErro("Esta criança já atingiu o limite de 4 padrinhos.");
      return;
    }
    setEnviando(true);
    try {
      const { data: dup, error: dupErr } = await supabase
        .from("padrinhos")
        .select("id")
        .eq("kid_id", aberta.id)
        .eq("email", email.toLowerCase())
        .neq("status", "cancelado")
        .limit(1);
      if (dupErr) throw dupErr;
      if (dup && dup.length) {
        setErro("Você já apadrinhou esta criança com este e-mail.");
        setEnviando(false);
        return;
      }
      const payload = {
        kid_id: aberta.id,
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        telefone: tel.trim() || null,
        mensagem: msg.trim() || null,
        status: "ativo",
      };
      const { error: insErr } = await supabase.from("padrinhos").insert(payload);
      if (insErr) throw insErr;
      setOk("Obrigado! Registro realizado com sucesso.");
      setContagem(prev => ({ ...prev, [aberta.id]: (prev[aberta.id] || 0) + 1 }));
    } catch (err) {
      console.error(err);
      setErro("Ocorreu um erro ao registrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Apadrinhe uma Criança</h1>
          <div className="text-sm text-neutral-600">Até 4 padrinhos por criança</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KIDS.map(kid => {
            const c = contagem[kid.id] || 0;
            const lotado = c >= 4;
            return (
              <div key={kid.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{kid.nome}</h2>
                    <p className="text-sm text-neutral-600">Idade: {kid.idade} anos</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-neutral-100">{c}/4</span>
                </div>
                <p className="mt-3 text-sm text-neutral-700">{kid.descricao}</p>
                <div className="mt-4 flex justify-end">
                  <button onClick={() => abrir(kid)} className="px-4 py-2 rounded-2xl bg-black text-white disabled:bg-neutral-300" disabled={lotado}>
                    {lotado ? "Limite atingido" : "Detalhes"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {aberta && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{aberta.nome} — {aberta.idade} anos</h3>
              <button onClick={fechar} className="p-2 hover:bg-neutral-100 rounded-full">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-neutral-700">{aberta.descricao}</p>
              <div className="p-3 bg-neutral-50 rounded-2xl text-sm">
                Padrinhos atuais: <strong>{contagem[aberta.id] || 0}/4</strong>
              </div>

              <form onSubmit={enviar} className="space-y-3">
                <div>
                  <label className="text-sm">Seu nome*</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Maria Silva"/>
                </div>
                <div>
                  <label className="text-sm">E-mail*</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="seu@email.com"/>
                </div>
                <div>
                  <label className="text-sm">Telefone (opcional)</label>
                  <input className="w-full border rounded-xl px-3 py-2" value={tel} onChange={e=>setTel(e.target.value)} placeholder="(11) 90000-0000"/>
                </div>
                <div>
                  <label className="text-sm">Mensagem (opcional)</label>
                  <textarea className="w-full border rounded-xl px-3 py-2" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Escreva uma breve mensagem (opcional)"/>
                </div>

                {erro && <div className="text-sm text-red-600">{erro}</div>}
                {ok && <div className="text-sm text-green-700">{ok}</div>}

                <div className="flex justify-end">
                  <button disabled={enviando} className="px-4 py-2 rounded-2xl bg-black text-white">
                    {enviando ? "Enviando..." : "Apadrinhar esta criança"}
                  </button>
                </div>
              </form>

              <p className="text-xs text-neutral-500">Ao enviar, você concorda em receber comunicações desta iniciativa.</p>
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 text-center text-xs text-neutral-500">
        Projeto solidário — feito com ❤️
      </footer>
    </div>
  );
}
