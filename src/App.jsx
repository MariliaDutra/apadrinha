import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [criancas, setCriancas] = useState([]);
  const [contagem, setContagem] = useState({});               // { kid_id: cotas_ocupadas }
  const [padrinhosPorKid, setPadrinhosPorKid] = useState({}); // { kid_id: [{nome, cotas}] }
  const [aberta, setAberta] = useState(null);

  // Form
  const [cotas, setCotas] = useState(1); // 1 (quarteto), 2 (dupla), 4 (sozinho)
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  const [parceiroNome, setParceiroNome] = useState("");
  const [parceiroEmail, setParceiroEmail] = useState("");
  const [parceiroTel, setParceiroTel] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);

  // ---- Carrega crianças
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("criancas")
        .select("kid_id, nome, idade, descricao, tamanho_roupa, tamanho_sapato, brinquedo_desejado, foto_url, observacoes")
        .order("kid_id", { ascending: true });
      if (!error && data) setCriancas(data);
    })();
  }, []);

  // ---- Soma de cotas e nomes (primeiro nome + cotas) por criança
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("padrinhos")
        .select("kid_id, cotas, nome")
        .neq("status", "cancelado");
      if (!error && data) {
        const c = {};
        const nomes = {};
        data.forEach(r => {
          const ocup = (r.cotas || 1);
          c[r.kid_id] = (c[r.kid_id] || 0) + ocup;
          const primeiro = String(r.nome || "").trim().split(" ")[0];
          if (primeiro) (nomes[r.kid_id] ||= []).push({ nome: primeiro, cotas: ocup });
        });
        setContagem(c);
        setPadrinhosPorKid(nomes);
      }
    })();
  }, []);

  const abrir = (kid) => {
    setAberta(kid);
    setCotas(1);
    setNome(""); setEmail(""); setTel(""); setMsg("");
    setParceiroNome(""); setParceiroEmail(""); setParceiroTel("");
    setErro(""); setOk("");
  };
  const fechar = () => setAberta(null);

  async function enviar(e) {
    e.preventDefault();
    setErro(""); setOk("");
    if (!aberta) return;

    // telefone obrigatório (mínimo 10 dígitos com DDD)
    const telDigits = (tel || "").replace(/\D/g, "");
    if (!nome.trim() || !email.trim() || telDigits.length < 10) {
      setErro("Nome, e-mail e telefone (com DDD) são obrigatórios.");
      return;
    }

    // disponibilidade: em dupla usa 4 cotas no total; sozinho 4; quarteto 1
    const ocupadas = contagem[aberta.kid_id] || 0;
    const requisitadas = (cotas === 2 ? 4 : cotas); // dupla = 4, sozinho = 4, quarteto = 1
    if (ocupadas + requisitadas > 4) {
      setErro(`Restam apenas ${Math.max(0, 4 - ocupadas)}/4 cotas para esta criança.`);
      return;
    }

    // em dupla: validar dados do(a) parceiro(a) (nome, email, tel)
    if (cotas === 2) {
      const telParceiroDigits = (parceiroTel || "").replace(/\D/g, "");
      if (!parceiroNome.trim() || !parceiroEmail.trim() || telParceiroDigits.length < 10) {
        setErro("Para apadrinhar em dupla, informe nome, e-mail e telefone (com DDD) do(a) parceiro(a).");
        return;
      }
      // evitar mesmo email para os dois
      if (parceiroEmail.trim().toLowerCase() === email.trim().toLowerCase()) {
        setErro("Os e-mails não podem ser iguais entre você e o(a) parceiro(a).");
        return;
      }
    }

    setEnviando(true);
    try {
      // impedir duplicidade (qualquer um dos e-mails já ativo nessa criança)
      const emailsParaChecar = cotas === 2
        ? [email.toLowerCase().trim(), parceiroEmail.toLowerCase().trim()]
        : [email.toLowerCase().trim()];

      const { data: dup, error: dupErr } = await supabase
        .from("padrinhos")
        .select("id, email")
        .eq("kid_id", aberta.kid_id)
        .in("email", emailsParaChecar)
        .neq("status", "cancelado");
      if (dupErr) throw dupErr;
      if (dup && dup.length) {
        setErro(`Já existe apadrinhamento ativo para este e-mail: ${dup[0].email}`);
        setEnviando(false);
        return;
      }

      // montar payload(s)
      if (cotas === 2) {
        // Dupla: duas linhas, cada uma com 2 cotas
        const payloads = [
          {
            kid_id: aberta.kid_id,
            nome: nome.trim(),
            email: email.toLowerCase().trim(),
            telefone: tel.trim(),
            mensagem: msg.trim() || null,
            status: "ativo",
            cotas: 2
          },
          {
            kid_id: aberta.kid_id,
            nome: parceiroNome.trim(),
            email: parceiroEmail.toLowerCase().trim(),
            telefone: parceiroTel.trim(),
            mensagem: msg.trim() || null,
            status: "ativo",
            cotas: 2
          }
        ];
        const { error: insErr } = await supabase.from("padrinhos").insert(payloads);
        if (insErr) throw insErr;

        setOk("Obrigado! Registro em dupla realizado com sucesso.");
        // atualiza contagem local ( +4 ) e chips (dois nomes, 2 cotas cada)
        setContagem(prev => ({ ...prev, [aberta.kid_id]: (prev[aberta.kid_id] || 0) + 4 }));
        setPadrinhosPorKid(prev => {
          const arr = [...(prev[aberta.kid_id] || [])];
          arr.push({ nome: (nome.trim().split(" ")[0] || "Padrinho"), cotas: 2 });
          arr.push({ nome: (parceiroNome.trim().split(" ")[0] || "Parceiro"), cotas: 2 });
          return { ...prev, [aberta.kid_id]: arr };
        });

      } else {
        // Sozinho (4 cotas) ou Quarteto (1 cota): uma linha
        const payload = {
          kid_id: aberta.kid_id,
          nome: nome.trim(),
          email: email.toLowerCase().trim(),
          telefone: tel.trim(),
          mensagem: msg.trim() || null,
          status: "ativo",
          cotas
        };
        const { error: insErr } = await supabase.from("padrinhos").insert(payload);
        if (insErr) throw insErr;

        setOk("Obrigado! Registro realizado com sucesso.");
        setContagem(prev => ({ ...prev, [aberta.kid_id]: (prev[aberta.kid_id] || 0) + cotas }));
        setPadrinhosPorKid(prev => {
          const arr = [...(prev[aberta.kid_id] || [])];
          arr.push({ nome: (nome.trim().split(" ")[0] || "Padrinho"), cotas });
          return { ...prev, [aberta.kid_id]: arr };
        });
      }
    } catch (err) {
      console.error(err);
      setErro("Ocorreu um erro ao registrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-orange-80">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Apadrinhe uma Criança</h1>
          <div className="text-sm text-neutral-600">Total por criança: 4 cotas</div>
        </div>
      </header>

      {/* Explicação */}
      <section className="max-w-6xl mx-auto px-4 pt-6">
  <div className="rounded-2xl border bg-white p-4 text-sm leading-6 text-neutral-700">
    <p>
      Neste fim de ano, o <a className="underline" href="https://instagram.com/kilombo_baoba" target="_blank" rel="noreferrer">
      Kilombo Baobá</a> é novamente nosso parceiro na nossa ação de apadrinhamento! 🌿✨</p>
    <p>
      Nosso <strong>projeto de apadrinhamento</strong> é uma forma especial de presentear e celebrar a infância das crianças de comunidade.
    </p>
    <ul className="list-disc pl-5 mt-2">
      <li>
        Cada criança pode ser apadrinhada por até <strong>quatro filhos</strong>.
      </li>
      <li>
        <strong>Apadrinhar sozinho(a):</strong> ocupa <strong>4 cotas</strong>.
      </li>
      <li>
        <strong>Apadrinhar em dupla:</strong> 2 cotas por pessoa (total de 4).
      </li>
      <li>
        <strong>Apadrinhar em quarteto:</strong> 1 cota por pessoa.
      </li>
    </ul>
    <p className="mt-2 text-neutral-600">
      Quando todas as 4 cotas são preenchidas, a criança aparecerá como <strong>“Criança apadrinhada”</strong> — sinalizando que aquela criança já possui padrinhos suficientes.
    </p>
 <p className="mt-2">
  Cada gesto conta. Cada cota é um passo rumo a um final de ano mais cheio de sorrisos.
</p>
<p className="mt-2">
  CEDEM é Umbanda
</p>
<p className="mt-2">
  Umbanda é Solidariedade
</p>
<p className="mt-2">
  Solidariedade é CEDEM 🧡
</p>
  </div>
</section>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {criancas.length === 0 ? (
          <div className="text-sm text-neutral-600">
            Nenhuma criança cadastrada.
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
                         {/* FOTO DA CRIANÇA */}
          {kid.foto_url && (
            <img
              src={kid.foto_url}
              alt={`Foto de ${kid.nome}`}
              className="w-24 h-24 object-cover rounded-full mb-2"
            />
          )}
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

                    {lotado ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                        Criança apadrinhada
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-neutral-100">{ocupadas}/4</span>
                    )}
                  </div>

                  {/* chips com quem já apadrinha */}
                  {(padrinhosPorKid[kid.kid_id]?.length) ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-700">
                      {padrinhosPorKid[kid.kid_id].map((p, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-full bg-neutral-100 border">
                          {p.nome} · {p.cotas}/4
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {kid.descricao && <p className="mt-3 text-sm text-neutral-700">{kid.descricao}</p>}

                  <div className="mt-4 flex justify-end">
                    {lotado ? (
                      <span className="px-4 py-2 rounded-2xl bg-neutral-200 text-neutral-600 cursor-not-allowed">
                        Criança apadrinhada
                      </span>
                    ) : (
                      <button onClick={() => abrir(kid)} className="px-4 py-2 rounded-2xl bg-black text-white">
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
    <div className="bg-white rounded-3xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto pb-4">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">{aberta.nome} — {aberta.idade} anos</h3>
        <button onClick={fechar} className="p-2 hover:bg-neutral-100 rounded-full">✕</button>
      </div>

      <div className="p-4 space-y-4">
        {/* Escolha de cotas (com rótulos claros) */}
        <div className="p-3 rounded-2xl bg-neutral-50 border">
          <div className="text-sm font-medium mb-2">Como você quer apadrinhar?</div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="cotas" value={4} checked={cotas===4} onChange={()=>setCotas(4)} />
              Apadrinhar sozinho(a) — ocupa 4 cotas
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="cotas" value={2} checked={cotas===2} onChange={()=>setCotas(2)} />
              Apadrinhar em dupla — ocupa 2 cotas por pessoa (total 4)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="cotas" value={1} checked={cotas===1} onChange={()=>setCotas(1)} />
              Apadrinhar em quarteto — ocupa 1 cota por pessoa
            </label>
          </div>
          <div className="mt-2 text-xs text-neutral-600">
            Disponíveis agora: <strong>{Math.max(0, 4 - (contagem[aberta.kid_id] || 0))}/4</strong>
          </div>
        </div>

        {/* Quem já está apadrinhando esta criança */}
        {(padrinhosPorKid[aberta.kid_id]?.length) ? (
          <div className="mt-3 p-3 rounded-2xl bg-white border text-sm">
            <div className="font-medium mb-1">Quem já está apadrinhando:</div>
            <div className="flex flex-wrap gap-2">
              {padrinhosPorKid[aberta.kid_id].map((p, idx) => (
                <span key={idx} className="px-2 py-1 rounded-full bg-neutral-100 border text-xs">
                  {p.nome} · {p.cotas}/4
                </span>
              ))}
            </div>
          </div>
        ) : null}

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
            <input className="w-full border rounded-xl px-3 py-2" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex.: Maria Silva" />
          </div>
          <div>
            <label className="text-sm">E-mail*</label>
            <input type="email" className="w-full border rounded-xl px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>
          <div>
            <label className="text-sm">Telefone (obrigatório)</label>
            <input required className="w-full border rounded-xl px-3 py-2" value={tel} onChange={e=>setTel(e.target.value)} placeholder="(11) 90000-0000" />
          </div>

          {/* Campos da dupla (apenas quando 2/4) */}
          {cotas === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Nome da dupla*</label>
                <input className="w-full border rounded-xl px-3 py-2" value={parceiroNome} onChange={e=>setParceiroNome(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">E-mail da dupla*</label>
                <input type="email" className="w-full border rounded-xl px-3 py-2" value={parceiroEmail} onChange={e=>setParceiroEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Telefone da dupla*</label>
                <input className="w-full border rounded-xl px-3 py-2" value={parceiroTel} onChange={e=>setParceiroTel(e.target.value)} placeholder="(11) 90000-0000" />
              </div>
            </div>
          )}

                <div>
                  <label className="text-sm">Mensagem (opcional)</label>
                  <textarea className="w-full border rounded-xl px-3 py-2" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Escreva uma breve mensagem (opcional)" />
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
