/* ===========================================================
   CARWALLET - SCRIPT PRINCIPAL E PADRÕES DE PROJETO (AV1)
   =========================================================== */

/* --- PADRÃO CRIACIONAL: SINGLETON --- */
// Garante que todo o aplicativo acesse uma ÚNICA instância do banco de dados (LocalStorage)
class DatabaseManager {
    constructor() {
        if (DatabaseManager.instance) {
            return DatabaseManager.instance;
        }
        DatabaseManager.instance = this;
    }

    salvar(chave, dados) {
        localStorage.setItem(chave, JSON.stringify(dados));
    }

    buscar(chave) {
        return JSON.parse(localStorage.getItem(chave)) || [];
    }

    remover(chave) {
        localStorage.removeItem(chave);
    }
}
const db = new DatabaseManager();

/* --- PADRÃO ESTRUTURAL: FACADE --- */
// Esconde a complexidade de calcular médias, validar odômetros e salvar despesas
class CarWalletFacade {
    constructor() {
        this.db = db; // Utiliza a instância Singleton
    }

    registrarDespesaUnificada(placa, tipo, descricao, valor, data, odometro, litros) {
        let despesas = this.db.buscar('despesas_' + placa);
        let consumoGerado = "N/A";

        // Lógica complexa escondida da interface
        if (tipo === 'Combustível' && odometro && litros) {
            let abastecimentos = despesas.filter(d => d.tipoDespesa === 'Combustível' && d.odometro);
            
            if (abastecimentos.length > 0) {
                let ultimo = abastecimentos[abastecimentos.length - 1];
                let kmRodados = parseFloat(odometro) - parseFloat(ultimo.odometro);
                
                if (kmRodados > 0) {
                    consumoGerado = (kmRodados / parseFloat(litros)).toFixed(1) + " km/l";
                } else {
                    consumoGerado = "Erro no painel";
                }
            } else {
                consumoGerado = "Primeiro registro";
            }
        }

        const novaDespesa = {
            tipoDespesa: tipo,
            descricao: descricao || tipo,
            valor: parseFloat(valor),
            data: data,
            odometro: odometro ? parseFloat(odometro) : null,
            litros: litros ? parseFloat(litros) : null,
            eficiencia: consumoGerado
        };

        despesas.push(novaDespesa);
        this.db.salvar('despesas_' + placa, despesas);
        
        return consumoGerado;
    }
}
const appFacade = new CarWalletFacade();


/* ===========================================================
   CONTROLADORES DE TELA (Lidando com o HTML)
   =========================================================== */

/* 1️⃣ CADASTRO DE VEÍCULO */
const veiculoForm = document.getElementById('veiculoForm');
if (veiculoForm) {
  veiculoForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const marca = document.getElementById('marca').value.trim();
    const modelo = document.getElementById('modelo').value.trim();
    const ano = document.getElementById('ano').value.trim();
    const placa = document.getElementById('placa').value.trim().toUpperCase();
    const combustivel = document.getElementById('combustivel').value;

    let veiculos = db.buscar('veiculos');
    if (veiculos.find(v => v.placa === placa)) {
      alert('Esta placa já está cadastrada no CarWallet!');
      return;
    }

    veiculos.push({ marca, modelo, ano, placa, combustivel });
    db.salvar('veiculos', veiculos);

    alert('Veículo cadastrado com sucesso!');
    window.location.href = 'relatorios.html';
  });
}

/* 2️⃣ LISTAGEM DE VEÍCULOS (DASHBOARD) */
const tabelaRelatoriosBody = document.getElementById('tabelaRelatoriosBody');
if (tabelaRelatoriosBody) {
  let veiculos = db.buscar('veiculos');

  function atualizarTabela() {
    tabelaRelatoriosBody.innerHTML = '';

    if (veiculos.length === 0) {
      tabelaRelatoriosBody.innerHTML = `<tr><td colspan="4" style="padding:15px;">Sua garagem está vazia.</td></tr>`;
      return;
    }

    veiculos.forEach((v, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b>${v.marca}</b> ${v.modelo} (${v.ano})</td>
        <td>${v.placa}</td>
        <td>${v.combustivel}</td>
        <td>
          <button class="botao" style="padding: 5px 10px; font-size: 13px;" onclick="registrarGasto('${v.placa}')">+ Despesa</button>
          <button class="botao-voltar" style="padding: 5px 10px; font-size: 13px; background-color: #dc3545;" onclick="excluirVeiculo(${index})">X</button>
        </td>
      `;
      tabelaRelatoriosBody.appendChild(tr);
    });
  }

  window.registrarGasto = (placa) => {
    localStorage.setItem('veiculoSelecionado', placa);
    window.location.href = 'registro_despesa.html';
  };

  window.excluirVeiculo = (index) => {
    if (!confirm('Deseja excluir este veículo e apagar todo o histórico de gastos?')) return;
    const placa = veiculos[index].placa;
    veiculos.splice(index, 1);
    db.salvar('veiculos', veiculos);
    db.remover('despesas_' + placa);
    atualizarTabela();
  };

  atualizarTabela();
}

/* 3️⃣ REGISTRO UNIFICADO DE DESPESA E ODÔMETRO */
const formDespesa = document.getElementById('formDespesa');
if (formDespesa) {
  const placaSelecionada = localStorage.getItem('veiculoSelecionado');
  if (!placaSelecionada) {
    alert('Por favor, selecione um veículo primeiro.');
    window.location.href = 'relatorios.html';
  }

  // Preenche o cabeçalho com a placa
  document.getElementById('infoPlacaDespesa').innerText = "Veículo Selecionado: " + placaSelecionada;

  // Lógica Dinâmica de UX: Mostrar Odômetro apenas para Combustível
  const selectTipo = document.getElementById('tipoDespesa');
  const blocoCombustivel = document.getElementById('blocoCombustivel');
  const inputOdometro = document.getElementById('odometro');
  const inputLitros = document.getElementById('litros');

  selectTipo.addEventListener('change', (e) => {
    if (e.target.value === 'Combustível') {
      blocoCombustivel.classList.add('visivel');
      inputOdometro.required = true;
      inputLitros.required = true;
    } else {
      blocoCombustivel.classList.remove('visivel');
      inputOdometro.required = false;
      inputLitros.required = false;
      inputOdometro.value = '';
      inputLitros.value = '';
    }
  });

  // Salvar despesa usando a Facade
  formDespesa.addEventListener('submit', (e) => {
    e.preventDefault();

    const tipo = selectTipo.value;
    const descricao = document.getElementById('descricao').value;
    const valor = document.getElementById('valor').value;
    const data = document.getElementById('data').value;
    const odometro = inputOdometro.value;
    const litros = inputLitros.value;

    // A mágica acontece aqui: A interface não calcula nada, só delega para a Facade.
    const eficiencia = appFacade.registrarDespesaUnificada(placaSelecionada, tipo, descricao, valor, data, odometro, litros);

    if(tipo === 'Combustível' && eficiencia !== "Primeiro registro") {
        alert(`Abastecimento registrado! Consumo calculado: ${eficiencia}`);
    } else {
        alert('Registro salvo com sucesso no CarWallet!');
    }
    
    window.location.href = 'relatorios.html';
  });
}
