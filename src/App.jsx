import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [criancas, setCriancas] = useState([]);
  const [contagem, setContagem] = useState({}); // { kid_id: cotas_ocupadas }
  const [aberta, setAberta] = useState(null);

  // Form
  const [cotas, setCotas] = useState(1); // 1,2,4
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Carrega crianças
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("criancas")
        .select("kid_id, nome, idade, descricao, tamanho_roupa, tamanho_sapato, brinquedo_desejado, foto_url, observacoes")
        .order("kid_id", { ascending: true });
      if (!error && data) setCriancas(data);
    })();
  }, []);

  // Soma de cotas ocupadas por criança
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("padrinhos")
        .select("kid_id, cotas")
        .neq("status", "cancelado");
      if (!error && data) {
        const c = {};
        data.forEach(r => c[r.kid_id] = (c[r.kid_id] || 0) + (r.cotas || 1));
        setContagem(c);
      }
    })();
  }, []);

  const abrir = (kid) => {
    setAberta(kid);
    setCotas(1); setNome(""); setEmail(""); setTel(""); setMsg("");
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

    const ocupadas = contagem[aberta.kid_id] || 0;
    if (ocupadas + cotas > 4) {
      setErro(`Restam apenas ${Math.max(0, 4 - ocupadas)}/4 cotas para esta criança.`);
      return;
    }

    setEnviando(true);
    try {
      // evitar duplicidade (mesmo e-mail na mesma criança, status ativo)
      const { data: dup, error: dupErr } = await supabase
        .from("padrinhos")
        .select("id")
        .eq("kid_id", aberta.kid_id)
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
        kid_id: aberta.kid_id,
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        telefone: tel.trim() || null,
        mensagem: msg.trim() || null,
        status: "ativo",
        cotas
      };
      const { error: insErr } = await supabase.from("padrinhos").insert(payload);
      if (insErr) throw insErr;

      setOk("Obrigado! Registro realizado com sucesso.");
      setContagem(prev => ({ ...prev, [aberta.kid_id]: (prev[aberta.kid_id] || 0) + cotas }));
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
          <div className="text-sm text-neutral-600">Total por criança: 4 cotas</div>
        </div>
      </header>

      {/* BLOCO DE EXPLICAÇÃO */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="rounded-2xl border bg-white p-4 text-sm leading-6 text-neutral-700">
          <p>
            Este é o nosso projeto de apadrinhamento de fim de ano realizado no{" "}
            <a className="underline" href="https://instagram.com/kilombobaoba" target="_blank" rel="noreferrer">
              Kilombo Baobá
            </a>.
            Cada criança pode receber até <strong>4 cotas</strong> de apadrinhamento.
          </p>
          <ul className="list-disc pl-5 mt-2">
            <li><strong>Apadrinhar sozinho(a):</strong> ocupa <strong>4 cotas</strong> (você cobre tudo).</li>
            <li><strong>Apadrinhar em dupla:</strong> ocupa <strong>2 cotas</strong> (cada pessoa).</li>
            <li><strong>Apadrinhar em quarteto:</strong> ocupa <strong>1 cota</strong> por pessoa.</li>
          </ul>
          <p className="mt-2 text-neutral-600">
            Quando as 4 cotas de uma criança são preenchidas, ela aparece como <strong>“Criança apadrinhada”</strong>.
          </p>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {criancas.length === 0 ? (
          <div className="text-sm text-neutral-600">
            Nenhuma criança cadastrada. Cadastre em <strong>Supabase → Table Editor → criancas</strong>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {criancas.map(kid => {
              const ocupadas = contagem[kid.kid_id] || 0;
              const lotado = ocupadas >= 4;
              return (
                <div key={kid.kid_id} className="rounded-2xl bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{kid.nome}</h2>
                      <p className="text-sm text-neutral-600">Idade: {kid.idade} anos</p>
                      {kid.brinquedo_desejado && (
                        <p className="text-sm text-neutral-700 mt-1">
                          🎁 Brinquedo: <span className="font-medium">{kid.brinquedo_desejado}</span>
                        </p>
                      )}
                      <div className="text-xs text-neutral-600 mt-1">
                        {kid.tamanho_roupa && <>👕 Roupa: <span className="font-medium">{kid.tamanho_roupa}</span>{' '}</>}
                        {kid.tamanho_sapato && <>👟 Sapato: <span className="font-medium">{kid.tamanho_sapato}</span></>}
                      </div>
                    </div>

                    {/* Badge à direita */}
                    {lotado ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                        Criança apadrinhada
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-100">{ocupadas}/4</span>
                    )}
                  </div>

                  {kid.descricao && <p className="mt-3 text-sm text-neutral-700">{kid.descricao}</p>}

                  <div className="mt-4 flex justify-end">
                    {lotado ? (
                      <span className="px-4 py-2 rounded-2xl bg-neutral-200 text-neutral-600 cursor-not-allowed">
                        Criança apadrinhada
                      </span>
                    ) : (
                      <button
                        onClick={() => abrir(kid)}
                        className="px-4 py-2 rounded-2xl bg-black text-white"
                      >
                        Detalhes
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {aberta && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">{aberta.nome} — {aberta.idade} anos</h3>
              <button onClick={fechar} className="p-2 hover:bg-neutral-100 rounded-full">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {/* PRIMEIRO: escolha de cotas com rótulos novos */}
              <div className="p-3 rounded-2xl bg-neutral-50 border">
                <div className="text-sm font-medium mb-2">Como você quer apadrinhar?</div>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cotas" value={4} checked={cotas===4} onChange={()=>setCotas(4)} />
                    Apadrinhar sozinho(a) — ocupa 4 cotas
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cotas" value={2} checked={cotas===2} onChange={()=>setCotas(2)} />
                    Apadrinhar em dupla — ocupa 2 cotas
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="cotas" value={1} checked={cotas===1} onChange={()=>setCotas(1)} />
                    Apadrinhar em quarteto — ocupa 1 cota
                  </label>
                </div>
                <div className="mt-2 text-xs text-neutral-600">
                  Disponíveis agora: <strong>{Math.max(0, 4 - (contagem[aberta.kid_id] || 0))}/4</strong>
                </div>
              </div>

              {/* Dados da criança */}
              {aberta.brinquedo_desejado && (
                <div className="text-sm">
                  🎁 <strong>Brinquedo desejado:</strong> {aberta.brinquedo_desejado}
                </div>
              )}
              <div className="text-sm">
                {aberta.tamanho_roupa && <>👕 <strong>Tamanho de roupa:</strong> {aberta.tamanho_roupa}<br/></>}
                {aberta.tamanho_sapato && <>👟 <strong>Tamanho de sapato:</strong> {aberta.tamanho_sapato}</>}
              </div>
              {aberta.descricao && <p className="text-sm text-neutral-700">{aberta.descricao}</p>}

              <div className="p-3 bg-neutral-50 rounded-2xl text-sm">
                Cotas ocupadas: <strong>{contagem[aberta.kid_id] || 0}/4</strong>
              </div>

              {/* Formulário */}
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
                  <button disabled={enviando || (contagem[aberta.kid_id] || 0) >= 4}
                          className="px-4 py-2 rounded-2xl bg-black text-white">
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
