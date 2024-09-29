const { NlpManager } = require("node-nlp");
const fs = require("fs");
const yaml = require("js-yaml");

const manager = new NlpManager({ languages: ["pt"], forceNER: true });

const loadYamlConversations = (filePath) => {
  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data = yaml.load(fileContents);
    return data.conversations;
  } catch (e) {
    console.log("Erro ao carregar o arquivo YAML:", e);
    return null;
  }
};

const addYamlConversations = (conversations) => {
  if (Array.isArray(conversations)) {
    conversations.forEach((conversation, index) => {
      if (conversation.pergunta && conversation.resposta) {
        const intent = `user.custom_${index}`; 

        manager.addDocument("pt", conversation.pergunta, intent);

        if (conversation.variações) {
          conversation.variações.forEach((variação) => {
            manager.addDocument("pt", variação, intent);
          });
        }

        // Adiciona a resposta associada
        if (Array.isArray(conversation.resposta)) {
          conversation.resposta.forEach((resposta) => {
            manager.addAnswer("pt", intent, resposta);
          });
        } else {
          manager.addAnswer("pt", intent, conversation.resposta);
        }
      }
    });
  } else {
    console.log("Formato inválido para as conversas. Esperado um array.");
  }
};

const processInput = async (manager, input, context = {}) => {
  const result = await manager.process("pt", input, context);

  if (result.answer) {
    return { answer: result.answer, intent: result.intent };
  } else {
    return { answer: "Não sei como responder a isso. Você pode me ensinar?", intent: null };
  }
};

const conversations = loadYamlConversations("./conversations.yml");
if (conversations) {
  addYamlConversations(conversations);
}

(async () => {
  await manager.train();
  manager.save();

  console.log('Chatbot está pronto! (Digite "sair" para encerrar)');

  let context = {}; 

  process.stdin.on("data", async (input) => {
    const message = input.toString().trim();
    if (message === "sair") {
      process.exit();
    }

    const response = await processInput(manager, message, context);
    console.log(`Chatbot: ${response.answer}`);

    if (response.intent) {
      context.intent = response.intent;
    } else {
      const userResponse = await new Promise((resolve) => {
        process.stdin.once("data", resolve);
      });

      manager.addDocument("pt", message, "user.custom");
      manager.addAnswer("pt", "user.custom", userResponse.toString().trim());

      await manager.train();
      manager.save();
    }
  });
})();
