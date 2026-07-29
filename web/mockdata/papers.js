window.MOCK_PAPERS = [
  {
    "id": "0bf3a1867f7245b8a702093901c66b08b518eafc",
    "title": "Evaluating Very Long-Term Conversational Memory of LLM Agents",
    "abstract": "Existing works on long-term open-domain dialogues focus on evaluating model responses within contexts spanning no more than five chat sessions. Despite advancements in long-context large language models (LLMs) and retrieval augmented generation (RAG) techniques, their efficacy in very long-term dialogues remains unexplored. To address this research gap, we introduce a machine-human pipeline to generate high-quality, very long-term dialogues by leveraging LLM-based agent architectures and grounding their dialogues on personas and temporal event graphs. Moreover, we equip each agent with the capability of sharing and reacting to images. The generated conversations are verified and edited by human annotators for long-range consistency and grounding to the event graphs. Using this pipeline, we collect LoCoMo, a dataset of very long-term conversations, each encompassing 300 turns and 9K tokens on avg., over up to 35 sessions. Based on LoCoMo, we present a comprehensive evaluation benchmark to measure long-term memory in models, encompassing question answering, event summarization, and multi-modal dialogue generation tasks. Our experimental results indicate that LLMs exhibit challenges in understanding lengthy conversations and comprehending long-range temporal and causal dynamics within dialogues. Employing strategies like long-context LLMs or RAG can offer improvements but these models still substantially lag behind human performance.",
    "authors": [
      {
        "name": "Adyasha Maharana"
      },
      {
        "name": "Dong-Ho Lee"
      },
      {
        "name": "S. Tulyakov"
      },
      {
        "name": "Mohit Bansal"
      },
      {
        "name": "Francesco Barbieri"
      },
      {
        "name": "Yuwei Fang"
      }
    ],
    "year": 2024,
    "publication_date": "2024-02-27",
    "venue": "Annual Meeting of the Association for Computational Linguistics",
    "citation_count": 658,
    "influential_citation_count": 139,
    "fields": [
      "Computer Science"
    ],
    "url": "https://www.semanticscholar.org/paper/0bf3a1867f7245b8a702093901c66b08b518eafc",
    "external_ids": {
      "ArXiv": "2402.17753",
      "CorpusId": "2.68041615e+08",
      "DBLP": "journals/corr/abs-2402-17753",
      "DOI": "10.48550/arXiv.2402.17753"
    },
    "match_score": 77,
    "read_minutes": 46,
    "source": "Semantic Scholar",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "AI 记忆挑战，对话更真实！",
      "problem": "现有方法在**非常长期对话**中的有效性未得到充分探索。",
      "novelty": [
        "构建**LoCoMo**数据集，包含非常长期对话。",
        "提出综合评估基准，涵盖问答、事件摘要和多模态对话生成。"
      ],
      "method": "使用LLM架构生成对话，并基于角色和事件图进行对话。",
      "result": "LLM在理解长对话和因果动态方面存在挑战。",
      "audience": "对LLM对话系统感兴趣的读者。",
      "why_keep": "为非常长期对话中的记忆评估提供新基准。",
      "reading_focus": "关注LoCoMo数据集和评估基准。"
    }
  },
  {
    "id": "1d9c21a0fdb1cc16a32c5d490ebaf98436a23382",
    "title": "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory",
    "abstract": "Large Language Models (LLMs) have demonstrated remarkable prowess in generating contextually coherent responses, yet their fixed context windows pose fundamental challenges for maintaining consistency over prolonged multi-session dialogues. We introduce Mem0, a scalable memory-centric architecture that addresses this issue by dynamically extracting, consolidating, and retrieving salient information from ongoing conversations. Building on this foundation, we further propose an enhanced variant that leverages graph-based memory representations to capture complex relational structures among conversational elements. Through comprehensive evaluations on LOCOMO benchmark, we systematically compare our approaches against six baseline categories: (i) established memory-augmented systems, (ii) retrieval-augmented generation (RAG) with varying chunk sizes and k-values, (iii) a full-context approach that processes the entire conversation history, (iv) an open-source memory solution, (v) a proprietary model system, and (vi) a dedicated memory management platform. Empirical results show that our methods consistently outperform all existing memory systems across four question categories: single-hop, temporal, multi-hop, and open-domain. Notably, Mem0 achieves 26% relative improvements in the LLM-as-a-Judge metric over OpenAI, while Mem0 with graph memory achieves around 2% higher overall score than the base configuration. Beyond accuracy gains, we also markedly reduce computational overhead compared to full-context method. In particular, Mem0 attains a 91% lower p95 latency and saves more than 90% token cost, offering a compelling balance between advanced reasoning capabilities and practical deployment constraints. Our findings highlight critical role of structured, persistent memory mechanisms for long-term conversational coherence, paving the way for more reliable and efficient LLM-driven AI agents.",
    "authors": [
      {
        "name": "P. Chhikara"
      },
      {
        "name": "Dev Khant"
      },
      {
        "name": "Saket Aryan"
      },
      {
        "name": "Taranjeet Singh"
      },
      {
        "name": "Deshraj Yadav"
      }
    ],
    "year": 2025,
    "publication_date": "2025-04-28",
    "venue": "European Conference on Artificial Intelligence",
    "citation_count": 485,
    "influential_citation_count": 91,
    "fields": [
      "Computer Science"
    ],
    "url": "https://www.semanticscholar.org/paper/1d9c21a0fdb1cc16a32c5d490ebaf98436a23382",
    "external_ids": {
      "ArXiv": "2504.19413",
      "CorpusId": "2.78165315e+08",
      "DBLP": "journals/corr/abs-2504-19413",
      "DOI": "10.48550/arXiv.2504.19413"
    },
    "match_score": 84,
    "read_minutes": 12,
    "source": "Semantic Scholar",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "长期对话记忆新架构，效果超越 OpenAI 26%！",
      "problem": "固定上下文窗口难以在多轮长期对话中保持一致性。",
      "novelty": [
        "提出 **Mem0**，动态提取、整合并检索对话中的关键信息。",
        "推出图记忆增强版本，用图结构捕捉对话要素间的复杂关系。"
      ],
      "method": "在 LOCOMO 基准上，与六类基线（记忆增强系统、不同粒度 RAG、全文本处理、开源方案、闭源模型、专用记忆平台）系统对比。",
      "result": "在单跳、多跳、时序、开放域四类问题上全面领先；较 OpenAI 在 LLM-as-a-Judge 指标提升 26%，图记忆版本再高约 2%；p95 延迟降低 91%，token 成本节省超 90%。",
      "audience": "关注 LLM 智能体长期记忆与工程落地的研究者，尤其计算机科学方向。",
      "why_keep": "与检索方向高度匹配 — 已获 485 次引用，是成熟的对照基线。",
      "reading_focus": "重点看方法框架、六类基线对比实验与延迟/成本数据。"
    }
  },
  {
    "id": "43b3ccf35dc3c65053ad4b2c930b4b9a3af87081",
    "title": "Hierarchical Memory for High-Efficiency Long-Term Reasoning in LLM Agents",
    "abstract": "Long-term memory is one of the key factors influencing the reasoning capabilities of Large Language Model Agents (LLM Agents). Incorporating a memory mechanism that effectively integrates past interactions can significantly enhance decision-making and contextual coherence of LLM Agents. While recent works have made progress in memory storage and retrieval, such as encoding memory into dense vectors for similarity-based search or organizing knowledge in the form of graph, these approaches often fall short in structured memory organization and efficient retrieval. To address these limitations, we propose a Hierarchical Memory (H-MEM) architecture for LLM Agents that organizes and updates memory in a multi-level fashion based on the degree of semantic abstraction. Each memory vector is embedded with a positional index encoding pointing to its semantically related sub-memories in the next layer. During the reasoning phase, an index-based routing mechanism enables efficient, layer-by-layer retrieval without performing exhaustive similarity computations. We evaluate our method on five task settings from the LoCoMo dataset. Experimental results show that our approach consistently outperforms five baseline methods, demonstrating its effectiveness in long-term dialogue scenarios.",
    "authors": [
      {
        "name": "Haoran Sun"
      },
      {
        "name": "Shaoning Zeng"
      }
    ],
    "year": 2025,
    "publication_date": "2025-07-23",
    "venue": "Conference of the European Chapter of the Association for Computational Linguistics",
    "citation_count": 46,
    "influential_citation_count": 2,
    "fields": [
      "Computer Science"
    ],
    "url": "https://www.semanticscholar.org/paper/43b3ccf35dc3c65053ad4b2c930b4b9a3af87081",
    "external_ids": {
      "ArXiv": "2507.22925",
      "CorpusId": "2.80401166e+08",
      "DBLP": "journals/corr/abs-2507-22925",
      "DOI": "10.48550/arXiv.2507.22925"
    },
    "match_score": 79,
    "read_minutes": 44,
    "source": "Semantic Scholar",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "AI 记忆分层，对话更高效！",
      "problem": "现有方法在**结构化记忆组织**和**高效检索**方面存在不足。",
      "novelty": [
        "提出**H-MEM**架构，多层级组织记忆。",
        "使用**位置索引编码**，实现高效检索。"
      ],
      "method": "基于语义抽象程度的多层级记忆组织，使用位置索引编码。",
      "result": "在五个任务设置上优于五个基线方法。",
      "audience": "对LLM对话系统感兴趣的读者。",
      "why_keep": "为长期对话中的记忆管理提供新方法。",
      "reading_focus": "关注H-MEM架构和实验结果。"
    }
  },
  {
    "id": "64d391ce7ab2474d2549911fc6d7ba0087ac31f4",
    "title": "Preference-Aware Memory Update for Long-Term LLM Agents",
    "abstract": "One of the key factors influencing the reasoning capabilities of LLM-based agents is their ability to leverage long-term memory. Integrating long-term memory mechanisms allows agents to make informed decisions grounded in historical interactions. While recent advances have significantly improved the storage and retrieval components, by encoding memory into dense vectors for similarity search or organizing memory as structured knowledge graphs most existing approaches fall short in memory updating. In particular, they lack mechanisms for dynamically refining preference memory representations in response to evolving user behaviors and contexts. To address this gap, we propose a Preference-Aware Memory Update Mechanism (PAMU) that enables dynamic and personalized memory refinement. By integrating sliding window averages (SW) with exponential moving averages (EMA), PAMU constructs a fused preference-aware representation that captures both short-term fluctuations and long-term user tendencies. We conduct experiments on five task scenarios of the LoCoMo dataset, and the results show that our mechanism can significantly improve the output quality of LLM in five baselines, validating its effectiveness in long-term conversations.",
    "authors": [
      {
        "name": "Haoran Sun"
      },
      {
        "name": "Zekun Zhang"
      },
      {
        "name": "Shaoning Zeng"
      }
    ],
    "year": 2025,
    "publication_date": "2025-10-10",
    "venue": "Annual Meeting of the Association for Computational Linguistics",
    "citation_count": 9,
    "influential_citation_count": 0,
    "fields": [
      "Computer Science"
    ],
    "url": "https://www.semanticscholar.org/paper/64d391ce7ab2474d2549911fc6d7ba0087ac31f4",
    "external_ids": {
      "ArXiv": "2510.09720",
      "CorpusId": "2.820586e+08",
      "DBLP": "journals/corr/abs-2510-09720",
      "DOI": "10.48550/arXiv.2510.09720"
    },
    "match_score": 80,
    "read_minutes": 43,
    "source": "Semantic Scholar",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "让AI记忆更精准，这篇论文教你如何更新偏好记忆！",
      "problem": "现有方法在更新长期记忆方面存在不足，缺乏对用户行为和上下文的动态调整机制。",
      "novelty": [
        "提出**偏好感知记忆更新机制**（PAMU）",
        "结合滑动窗口平均（SW）和指数移动平均（EMA）",
        "实现动态和个性化的记忆优化"
      ],
      "method": "通过滑动窗口平均（SW）和指数移动平均（EMA）构建融合的偏好感知表示，捕捉短期波动和长期用户趋势。",
      "result": "在五个任务场景中，PAMU显著提高了LLM的输出质量。",
      "audience": "对LLM长期对话性能感兴趣的读者。",
      "why_keep": "为LLM长期记忆更新提供了新的思路和方法。",
      "reading_focus": "关注PAMU机制的具体实现和实验结果。"
    }
  },
  {
    "id": "arxiv:1811.08772v1",
    "title": "Overcoming low-utility facets for complex answer retrieval",
    "abstract": "Many questions cannot be answered simply; their answers must include numerous nuanced details and additional context. Complex Answer Retrieval (CAR) is the retrieval of answers to such questions. In their simplest form, these questions are constructed from a topic entity (e.g., `cheese') and a facet (e.g., `health effects'). While topic matching has been thoroughly explored, we observe that some facets use general language that is unlikely to appear verbatim in answers. We call these low-utility facets. In this work, we present an approach to CAR that identifies and addresses low-utility facets. We propose two estimators of facet utility. These include exploiting the hierarchical structure of CAR queries and using facet frequency information from training data. To improve the retrieval performance on low-utility headings, we also include entity similarity scores using knowledge graph embeddings. We apply our approaches to a leading neural ranking technique, and evaluate using the TREC CAR dataset. We find that our approach perform significantly better than the unmodified neural ranker and other leading CAR techniques. We also provide a detailed analysis of our results, and verify that low-utility facets are indeed more difficult to match, and that our approach improves the performance for these difficult queries.",
    "authors": [
      {
        "name": "Sean MacAvaney"
      },
      {
        "name": "Andrew Yates"
      },
      {
        "name": "Arman Cohan"
      },
      {
        "name": "Luca Soldaini"
      },
      {
        "name": "Kai Hui"
      },
      {
        "name": "Nazli Goharian"
      },
      {
        "name": "Ophir Frieder"
      }
    ],
    "year": 2018,
    "publication_date": "2018-11-21",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR"
    ],
    "url": "http://arxiv.org/abs/1811.08772v1",
    "pdf_url": "https://arxiv.org/pdf/1811.08772v1",
    "external_ids": {
      "ArXiv": "1811.08772v1"
    },
    "match_score": 57,
    "read_minutes": 46,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "复杂问题答案检索，这篇论文让机器更懂细节！",
      "problem": "复杂问题答案检索中，低效的方面（如低效用方面）难以匹配。",
      "novelty": [
        "提出识别和解决低效用方面的方法",
        "利用CAR查询的层次结构和训练数据的方面频率信息",
        "使用知识图嵌入的实体相似度分数"
      ],
      "method": "提出两种方面效用估计器，并应用到神经排名技术中。",
      "result": "在TREC CAR数据集上，我们的方法比未修改的神经排名器和其他领先的CAR技术表现更好。",
      "audience": "对复杂问题答案检索感兴趣的读者。",
      "why_keep": "为复杂问题答案检索提供了新的方法和思路。",
      "reading_focus": "关注低效用方面的识别和解决方法。"
    }
  },
  {
    "id": "arxiv:2202.11233v1",
    "title": "Retrieval Augmented Classification for Long-Tail Visual Recognition",
    "abstract": "We introduce Retrieval Augmented Classification (RAC), a generic approach to augmenting standard image classification pipelines with an explicit retrieval module. RAC consists of a standard base image encoder fused with a parallel retrieval branch that queries a non-parametric external memory of pre-encoded images and associated text snippets. We apply RAC to the problem of long-tail classification and demonstrate a significant improvement over previous state-of-the-art on Places365-LT and iNaturalist-2018 (14.5% and 6.7% respectively), despite using only the training datasets themselves as the external information source. We demonstrate that RAC's retrieval module, without prompting, learns a high level of accuracy on tail classes. This, in turn, frees the base encoder to focus on common classes, and improve its performance thereon. RAC represents an alternative approach to utilizing large, pretrained models without requiring fine-tuning, as well as a first step towards more effectively making use of external memory within common computer vision architectures.",
    "authors": [
      {
        "name": "Alexander Long"
      },
      {
        "name": "Wei Yin"
      },
      {
        "name": "Thalaiyasingam Ajanthan"
      },
      {
        "name": "Vu Nguyen"
      },
      {
        "name": "Pulak Purkait"
      },
      {
        "name": "Ravi Garg"
      },
      {
        "name": "Alan Blair"
      },
      {
        "name": "Chunhua Shen"
      },
      {
        "name": "Anton van den Hengel"
      }
    ],
    "year": 2022,
    "publication_date": "2022-02-22",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CV"
    ],
    "url": "http://arxiv.org/abs/2202.11233v1",
    "pdf_url": "https://arxiv.org/pdf/2202.11233v1",
    "external_ids": {
      "ArXiv": "2202.11233v1"
    },
    "match_score": 53,
    "read_minutes": 42,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "长尾视觉识别，RAC帮你轻松搞定！",
      "problem": "传统图像分类在长尾分类上表现不佳。",
      "novelty": [
        "RAC通过检索模块增强分类性能",
        "在Places365-LT和iNaturalist-2018上取得显著提升",
        "无需微调即可利用外部记忆"
      ],
      "method": "将RAC应用于长尾分类问题，通过检索模块查询预编码图像和文本。",
      "result": "在长尾分类上取得14.5%和6.7%的提升。",
      "audience": "对计算机视觉和图像分类感兴趣的研究人员和开发者。",
      "why_keep": "为长尾视觉识别提供新的解决方案。",
      "reading_focus": "RAC的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2212.10423v1",
    "title": "Fine-Grained Distillation for Long Document Retrieval",
    "abstract": "Long document retrieval aims to fetch query-relevant documents from a large-scale collection, where knowledge distillation has become de facto to improve a retriever by mimicking a heterogeneous yet powerful cross-encoder. However, in contrast to passages or sentences, retrieval on long documents suffers from the scope hypothesis that a long document may cover multiple topics. This maximizes their structure heterogeneity and poses a granular-mismatch issue, leading to an inferior distillation efficacy. In this work, we propose a new learning framework, fine-grained distillation (FGD), for long-document retrievers. While preserving the conventional dense retrieval paradigm, it first produces global-consistent representations crossing different fine granularity and then applies multi-granular aligned distillation merely during training. In experiments, we evaluate our framework on two long-document retrieval benchmarks, which show state-of-the-art performance.",
    "authors": [
      {
        "name": "Yucheng Zhou"
      },
      {
        "name": "Tao Shen"
      },
      {
        "name": "Xiubo Geng"
      },
      {
        "name": "Chongyang Tao"
      },
      {
        "name": "Guodong Long"
      },
      {
        "name": "Can Xu"
      },
      {
        "name": "Daxin Jiang"
      }
    ],
    "year": 2022,
    "publication_date": "2022-12-20",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR",
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2212.10423v1",
    "pdf_url": "https://arxiv.org/pdf/2212.10423v1",
    "external_ids": {
      "ArXiv": "2212.10423v1"
    },
    "match_score": 52,
    "read_minutes": 40,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "长文档检索，细粒度蒸馏让效果翻倍。",
      "problem": "长文档检索面临范围假设问题，导致结构异质性增加，影响蒸馏效果。",
      "novelty": [
        "提出细粒度蒸馏（FGD）框架，解决长文档检索中的粒度不匹配问题。",
        "FGD在训练期间仅应用多粒度对齐蒸馏，提高蒸馏效果。"
      ],
      "method": "FGD框架，在保留传统密集检索范式的同时，产生全局一致的表示，然后应用多粒度对齐蒸馏。",
      "result": "在两个长文档检索基准测试中，FGD框架表现出最先进的性能。",
      "audience": "对长文档检索和知识蒸馏感兴趣的研究人员和工程师。",
      "why_keep": "为长文档检索领域提供了新的学习框架。",
      "reading_focus": "关注FGD框架的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2304.12244v3",
    "title": "WizardLM: Empowering large pre-trained language models to follow complex instructions",
    "abstract": "Training large language models (LLMs) with open-domain instruction following data brings colossal success. However, manually creating such instruction data is very time-consuming and labor-intensive. Moreover, humans may struggle to produce high-complexity instructions. In this paper, we show an avenue for creating large amounts of instruction data with varying levels of complexity using LLM instead of humans. Starting with an initial set of instructions, we use our proposed Evol-Instruct to rewrite them step by step into more complex instructions. Then, we mix all generated instruction data to fine-tune LLaMA. We call the resulting model WizardLM. Human evaluations on a complexity-balanced test bed and Vicuna's testset show that instructions from Evol-Instruct are superior to human-created ones. By analyzing the human evaluation results of the high complexity part, we demonstrate that outputs from our WizardLM are preferred to outputs from OpenAI ChatGPT. In GPT-4 automatic evaluation, WizardLM achieves more than 90\\% capacity of ChatGPT on 17 out of 29 skills. Even though WizardLM still lags behind ChatGPT in some aspects, our findings suggest that fine-tuning with AI-evolved instructions is a promising direction for enhancing LLMs. Our code and data are public at https://github.com/nlpxucan/WizardLM",
    "authors": [
      {
        "name": "Can Xu"
      },
      {
        "name": "Qingfeng Sun"
      },
      {
        "name": "Kai Zheng"
      },
      {
        "name": "Xiubo Geng"
      },
      {
        "name": "Pu Zhao"
      },
      {
        "name": "Jiazhan Feng"
      },
      {
        "name": "Chongyang Tao"
      },
      {
        "name": "Qingwei Lin"
      },
      {
        "name": "Daxin Jiang"
      }
    ],
    "year": 2023,
    "publication_date": "2023-04-24",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2304.12244v3",
    "pdf_url": "https://arxiv.org/pdf/2304.12244v3",
    "external_ids": {
      "ArXiv": "2304.12244v3"
    },
    "match_score": 64,
    "read_minutes": 45,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "让大模型听话，这篇论文有新招！",
      "problem": "手动创建复杂指令数据耗时费力，且人类难以产生高复杂度指令。",
      "novelty": [
        "使用LLM生成大量不同复杂度的指令数据。",
        "提出Evol-Instruct，逐步将指令复杂化。",
        "WizardLM在多项技能上达到ChatGPT的90%以上能力。"
      ],
      "method": "使用LLM生成指令数据，并使用Evol-Instruct逐步复杂化指令，最后微调LLaMA模型得到WizardLM。",
      "result": "WizardLM在多项技能上达到ChatGPT的90%以上能力。",
      "audience": "对LLM指令遵循和复杂指令生成感兴趣的读者。",
      "why_keep": "为LLM指令遵循和复杂指令生成提供了新的方法。",
      "reading_focus": "关注Evol-Instruct和WizardLM的具体实现和实验结果。"
    }
  },
  {
    "id": "arxiv:2306.13549v4",
    "title": "A Survey on Multimodal Large Language Models",
    "abstract": "Recently, Multimodal Large Language Model (MLLM) represented by GPT-4V has been a new rising research hotspot, which uses powerful Large Language Models (LLMs) as a brain to perform multimodal tasks. The surprising emergent capabilities of MLLM, such as writing stories based on images and OCR-free math reasoning, are rare in traditional multimodal methods, suggesting a potential path to artificial general intelligence. To this end, both academia and industry have endeavored to develop MLLMs that can compete with or even better than GPT-4V, pushing the limit of research at a surprising speed. In this paper, we aim to trace and summarize the recent progress of MLLMs. First of all, we present the basic formulation of MLLM and delineate its related concepts, including architecture, training strategy and data, as well as evaluation. Then, we introduce research topics about how MLLMs can be extended to support more granularity, modalities, languages, and scenarios. We continue with multimodal hallucination and extended techniques, including Multimodal ICL (M-ICL), Multimodal CoT (M-CoT), and LLM-Aided Visual Reasoning (LAVR). To conclude the paper, we discuss existing challenges and point out promising research directions. In light of the fact that the era of MLLM has only just begun, we will keep updating this survey and hope it can inspire more research. An associated GitHub link collecting the latest papers is available at https://github.com/BradyFU/Awesome-Multimodal-Large-Language-Models.",
    "authors": [
      {
        "name": "Shukang Yin"
      },
      {
        "name": "Chaoyou Fu"
      },
      {
        "name": "Sirui Zhao"
      },
      {
        "name": "Ke Li"
      },
      {
        "name": "Xing Sun"
      },
      {
        "name": "Tong Xu"
      },
      {
        "name": "Enhong Chen"
      }
    ],
    "year": 2023,
    "publication_date": "2023-06-23",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CV",
      "cs.AI",
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2306.13549v4",
    "pdf_url": "https://arxiv.org/pdf/2306.13549v4",
    "external_ids": {
      "ArXiv": "2306.13549v4"
    },
    "match_score": 63,
    "read_minutes": 48,
    "source": "arXiv",
    "digest": {
      "verdict": "必读",
      "hook": "多模态大语言模型崛起，开启通用人工智能新篇章！",
      "problem": "传统多模态方法难以实现通用人工智能，MLLMs应运而生。",
      "novelty": [
        "MLLMs结合LLMs进行多模态任务，如基于图像的写作和OCR-free数学推理。",
        "MLLMs有望成为通用人工智能的潜在路径。",
        "学术和工业界都在努力开发与GPT-4V竞争的MLLMs。"
      ],
      "method": "介绍MLLMs的基本公式、相关概念、架构、训练策略、数据和评估。",
      "result": "推动MLLMs研究以惊人的速度发展。",
      "audience": "对通用人工智能和多模态大语言模型感兴趣的研究人员和开发者。",
      "why_keep": "MLLMs是通用人工智能研究的关键领域，具有重大意义。",
      "reading_focus": "关注MLLMs的架构、训练策略和评估方法。"
    }
  },
  {
    "id": "arxiv:2309.02144v1",
    "title": "Making Large Language Models Better Reasoners with Alignment",
    "abstract": "Reasoning is a cognitive process of using evidence to reach a sound conclusion. The reasoning capability is essential for large language models (LLMs) to serve as the brain of the artificial general intelligence agent. Recent studies reveal that fine-tuning LLMs on data with the chain of thought (COT) reasoning process can significantly enhance their reasoning capabilities. However, we find that the fine-tuned LLMs suffer from an \\textit{Assessment Misalignment} problem, i.e., they frequently assign higher scores to subpar COTs, leading to potential limitations in their reasoning abilities. To address this problem, we introduce an \\textit{Alignment Fine-Tuning (AFT)} paradigm, which involves three steps: 1) fine-tuning LLMs with COT training data; 2) generating multiple COT responses for each question, and categorizing them into positive and negative ones based on whether they achieve the correct answer; 3) calibrating the scores of positive and negative responses given by LLMs with a novel constraint alignment loss. Specifically, the constraint alignment loss has two objectives: a) Alignment, which guarantees that positive scores surpass negative scores to encourage answers with high-quality COTs; b) Constraint, which keeps the negative scores confined to a reasonable range to prevent the model degradation. Beyond just the binary positive and negative feedback, the constraint alignment loss can be seamlessly adapted to the ranking situations when ranking feedback is accessible. Furthermore, we also delve deeply into recent ranking-based alignment methods, such as DPO, RRHF, and PRO, and discover that the constraint, which has been overlooked by these approaches, is also crucial for their performance. Extensive experiments on four reasoning benchmarks with both binary and ranking feedback demonstrate the effectiveness of AFT.",
    "authors": [
      {
        "name": "Peiyi Wang"
      },
      {
        "name": "Lei Li"
      },
      {
        "name": "Liang Chen"
      },
      {
        "name": "Feifan Song"
      },
      {
        "name": "Binghuai Lin"
      },
      {
        "name": "Yunbo Cao"
      },
      {
        "name": "Tianyu Liu"
      },
      {
        "name": "Zhifang Sui"
      }
    ],
    "year": 2023,
    "publication_date": "2023-09-05",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI",
      "cs.LG"
    ],
    "url": "http://arxiv.org/abs/2309.02144v1",
    "pdf_url": "https://arxiv.org/pdf/2309.02144v1",
    "external_ids": {
      "ArXiv": "2309.02144v1"
    },
    "match_score": 65,
    "read_minutes": 52,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "让大语言模型更会推理，这篇论文有妙招！",
      "problem": "大语言模型在推理时存在评估偏差问题，即对质量一般的推理过程给予过高评分。",
      "novelty": [
        "引入**Alignment Fine-Tuning (AFT**)范式，解决评估偏差问题。",
        "通过**约束对齐损失**调整正负评分，提升推理能力。",
        "扩展到排名反馈情况，提高模型性能。"
      ],
      "method": "使用COT训练数据微调LLM，生成多个COT响应，并使用约束对齐损失调整评分。",
      "result": "在四个推理基准上，AFT方法显著提升了LLM的推理能力。",
      "audience": "对大语言模型推理能力提升感兴趣的读者。",
      "why_keep": "AFT方法为LLM推理能力提升提供了新的思路。",
      "reading_focus": "关注AFT方法的具体实现和实验结果。"
    }
  },
  {
    "id": "arxiv:2312.05434v1",
    "title": "Beneath the Surface: Unveiling Harmful Memes with Multimodal Reasoning Distilled from Large Language Models",
    "abstract": "The age of social media is rife with memes. Understanding and detecting harmful memes pose a significant challenge due to their implicit meaning that is not explicitly conveyed through the surface text and image. However, existing harmful meme detection approaches only recognize superficial harm-indicative signals in an end-to-end classification manner but ignore in-depth cognition of the meme text and image. In this paper, we attempt to detect harmful memes based on advanced reasoning over the interplay of multimodal information in memes. Inspired by the success of Large Language Models (LLMs) on complex reasoning, we first conduct abductive reasoning with LLMs. Then we propose a novel generative framework to learn reasonable thoughts from LLMs for better multimodal fusion and lightweight fine-tuning, which consists of two training stages: 1) Distill multimodal reasoning knowledge from LLMs; and 2) Fine-tune the generative framework to infer harmfulness. Extensive experiments conducted on three meme datasets demonstrate that our proposed approach achieves superior performance than state-of-the-art methods on the harmful meme detection task.",
    "authors": [
      {
        "name": "Hongzhan Lin"
      },
      {
        "name": "Ziyang Luo"
      },
      {
        "name": "Jing Ma"
      },
      {
        "name": "Long Chen"
      }
    ],
    "year": 2023,
    "publication_date": "2023-12-09",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2312.05434v1",
    "pdf_url": "https://arxiv.org/pdf/2312.05434v1",
    "external_ids": {
      "ArXiv": "2312.05434v1"
    },
    "match_score": 75,
    "read_minutes": 43,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "识破网络迷思！大模型帮你揪出有害表情包",
      "problem": "有害表情包的隐含意义难以通过表面文本和图像直接传达，现有检测方法只识别表面信号，忽略了深入认知。",
      "novelty": [
        "基于多模态推理检测有害表情包",
        "利用大模型进行推理",
        "提出新型生成框架进行轻量级微调"
      ],
      "method": "首先利用大模型进行推理，然后提出一个新型生成框架，通过两个训练阶段来学习合理的思想，从而更好地融合多模态信息和进行轻量级微调。",
      "result": "在有害表情包检测任务上，提出的方法优于现有方法。",
      "audience": "对有害内容检测和表情包分析感兴趣的研究人员和开发者。",
      "why_keep": "为有害内容检测提供新的思路和方法。",
      "reading_focus": "关注多模态推理在表情包分析中的应用，以及新型生成框架的设计。"
    }
  },
  {
    "id": "arxiv:2312.10793v3",
    "title": "Demystifying Instruction Mixing for Fine-tuning Large Language Models",
    "abstract": "Instruction tuning significantly enhances the performance of large language models (LLMs) across various tasks. However, the procedure to optimizing the mixing of instruction datasets for LLM fine-tuning is still poorly understood. This study categorizes instructions into three primary types: NLP downstream tasks, coding, and general chat. We explore the effects of instruction tuning on different combinations of datasets on LLM performance, and find that certain instruction types are more advantageous for specific applications but can negatively impact other areas. This work provides insights into instruction mixtures, laying the foundations for future research.",
    "authors": [
      {
        "name": "Renxi Wang"
      },
      {
        "name": "Haonan Li"
      },
      {
        "name": "Minghao Wu"
      },
      {
        "name": "Yuxia Wang"
      },
      {
        "name": "Xudong Han"
      },
      {
        "name": "Chiyu Zhang"
      },
      {
        "name": "Timothy Baldwin"
      }
    ],
    "year": 2023,
    "publication_date": "2023-12-17",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2312.10793v3",
    "pdf_url": "https://arxiv.org/pdf/2312.10793v3",
    "external_ids": {
      "ArXiv": "2312.10793v3"
    },
    "match_score": 69,
    "read_minutes": 39,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "LLM微调，指令混合的奥秘大揭秘！",
      "problem": "LLM微调中指令数据集的混合优化方法尚不明确。",
      "novelty": [
        "将指令分为NLP下游任务、编码和通用聊天三类",
        "发现特定指令类型对特定应用更有优势"
      ],
      "method": "对指令数据集进行分类和效果分析。",
      "result": "为LLM微调提供了对指令混合的深入理解。",
      "audience": "LLM微调研究者。",
      "why_keep": "为LLM微调提供了理论基础。",
      "reading_focus": "关注指令分类和效果分析。"
    }
  },
  {
    "id": "arxiv:2402.11651v2",
    "title": "Learning From Failure: Integrating Negative Examples when Fine-tuning Large Language Models as Agents",
    "abstract": "Large language models (LLMs) have achieved success in acting as agents, which interact with environments through tools such as search engines. However, LLMs are optimized for language generation instead of tool use during training or alignment, limiting their effectiveness as agents. To resolve this problem, previous work has first collected interaction trajectories between LLMs and environments, using only trajectories that successfully finished the task to fine-tune smaller models, making fine-tuning data scarce and acquiring it both difficult and costly. Discarding failed trajectories also leads to significant wastage of data and resources and limits the possible optimization paths during fine-tuning. In this paper, we argue that unsuccessful trajectories offer valuable insights, and LLMs can learn from these trajectories through appropriate quality control and fine-tuning strategies. By simply adding a prefix or suffix that tells the model whether to generate a successful trajectory during training, we improve model performance by a large margin on mathematical reasoning, multi-hop question answering, and strategic question answering tasks. We further analyze the inference results and find that our method provides a better trade-off between valuable information and errors in unsuccessful trajectories. To our knowledge, we are the first to demonstrate the value of negative trajectories and their application in agent-tunning scenarios. Our findings offer guidance for developing better agent-tuning methods and low-resource data usage techniques.",
    "authors": [
      {
        "name": "Renxi Wang"
      },
      {
        "name": "Haonan Li"
      },
      {
        "name": "Xudong Han"
      },
      {
        "name": "Yixuan Zhang"
      },
      {
        "name": "Timothy Baldwin"
      }
    ],
    "year": 2024,
    "publication_date": "2024-02-18",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2402.11651v2",
    "pdf_url": "https://arxiv.org/pdf/2402.11651v2",
    "external_ids": {
      "ArXiv": "2402.11651v2"
    },
    "match_score": 82,
    "read_minutes": 48,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "失败也能成师！用失败案例调教大模型当智能助手",
      "problem": "大模型作为智能助手，训练时更擅长语言生成而非工具使用，限制了其作为智能助手的效能。",
      "novelty": [
        "利用失败案例进行微调",
        "增加负样本轨迹，提高模型性能",
        "首次证明负轨迹在智能助手调教场景中的价值"
      ],
      "method": "通过添加前缀或后缀，让模型在训练时知道是否生成成功轨迹，从而提高模型在数学推理、多跳问答和战略问答任务上的性能。",
      "result": "在数学推理、多跳问答和战略问答任务上，模型性能大幅提升。",
      "audience": "对大模型作为智能助手的研究感兴趣的研究人员和开发者。",
      "why_keep": "为开发更好的智能助手调教方法和低资源数据使用技术提供指导。",
      "reading_focus": "关注如何利用失败案例进行微调，以及负样本轨迹在智能助手调教场景中的应用。"
    }
  },
  {
    "id": "arxiv:2402.14679v2",
    "title": "Is Self-knowledge and Action Consistent or Not: Investigating Large Language Model's Personality",
    "abstract": "In this study, we delve into the validity of conventional personality questionnaires in capturing the human-like personality traits of Large Language Models (LLMs). Our objective is to assess the congruence between the personality traits LLMs claim to possess and their demonstrated tendencies in real-world scenarios. By conducting an extensive examination of LLM outputs against observed human response patterns, we aim to understand the disjunction between self-knowledge and action in LLMs.",
    "authors": [
      {
        "name": "Yiming Ai"
      },
      {
        "name": "Zhiwei He"
      },
      {
        "name": "Ziyin Zhang"
      },
      {
        "name": "Wenhong Zhu"
      },
      {
        "name": "Hongkun Hao"
      },
      {
        "name": "Kai Yu"
      },
      {
        "name": "Lingjun Chen"
      },
      {
        "name": "Rui Wang"
      }
    ],
    "year": 2024,
    "publication_date": "2024-02-22",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.CY"
    ],
    "url": "http://arxiv.org/abs/2402.14679v2",
    "pdf_url": "https://arxiv.org/pdf/2402.14679v2",
    "external_ids": {
      "ArXiv": "2402.14679v2"
    },
    "match_score": 75,
    "read_minutes": 37,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "大模型有性格吗？探究其自我认知与行为的一致性",
      "problem": "传统人格问卷在捕捉大模型类似人类的人格特质方面存在局限性。",
      "novelty": [
        "评估大模型声称拥有的人格特质与实际行为的一致性",
        "对比大模型输出与人类响应模式",
        "探究大模型自我认知与行为之间的不一致性"
      ],
      "method": "通过对比大模型输出与人类响应模式，评估大模型声称拥有的人格特质与实际行为的一致性。",
      "result": "研究揭示了大模型自我认知与行为之间可能存在的不一致性。",
      "audience": "对大模型人格特质的评估和人工智能伦理感兴趣的研究人员和开发者。",
      "why_keep": "为人工智能伦理和人格特质评估提供新的视角。",
      "reading_focus": "关注大模型人格特质的评估方法和结果分析。"
    }
  },
  {
    "id": "arxiv:2402.15276v3",
    "title": "CFIR: Fast and Effective Long-Text To Image Retrieval for Large Corpora",
    "abstract": "Text-to-image retrieval aims to find the relevant images based on a text query, which is important in various use-cases, such as digital libraries, e-commerce, and multimedia databases. Although Multimodal Large Language Models (MLLMs) demonstrate state-of-the-art performance, they exhibit limitations in handling large-scale, diverse, and ambiguous real-world needs of retrieval, due to the computation cost and the injective embeddings they produce. This paper presents a two-stage Coarse-to-Fine Index-shared Retrieval (CFIR) framework, designed for fast and effective large-scale long-text to image retrieval. The first stage, Entity-based Ranking (ER), adapts to long-text query ambiguity by employing a multiple-queries-to-multiple-targets paradigm, facilitating candidate filtering for the next stage. The second stage, Summary-based Re-ranking (SR), refines these rankings using summarized queries. We also propose a specialized Decoupling-BEiT-3 encoder, optimized for handling ambiguous user needs and both stages, which also enhances computational efficiency through vector-based similarity inference. Evaluation on the AToMiC dataset reveals that CFIR surpasses existing MLLMs by up to 11.06% in Recall@1000, while reducing training and retrieval times by 68.75% and 99.79%, respectively. We will release our code to facilitate future research at https://github.com/longkukuhi/CFIR.",
    "authors": [
      {
        "name": "Zijun Long"
      },
      {
        "name": "Xuri Ge"
      },
      {
        "name": "Richard Mccreadie"
      },
      {
        "name": "Joemon Jose"
      }
    ],
    "year": 2024,
    "publication_date": "2024-02-23",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR",
      "cs.AI",
      "cs.CV"
    ],
    "url": "http://arxiv.org/abs/2402.15276v3",
    "pdf_url": "https://arxiv.org/pdf/2402.15276v3",
    "external_ids": {
      "ArXiv": "2402.15276v3"
    },
    "match_score": 63,
    "read_minutes": 44,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "海量文本检索，这篇论文让图片搜索飞快又精准！",
      "problem": "现有多模态大语言模型在处理大规模、多样化、模糊的检索需求时，存在计算成本高和注入嵌入的问题。",
      "novelty": [
        "提出两阶段CFIR框架，实现快速有效的长文本到图像检索。",
        "ER阶段通过多查询到多目标范式适应长文本查询模糊性。",
        "SR阶段使用总结查询细化排名。"
      ],
      "method": "设计了两阶段CFIR框架，包括基于实体的排名（ER）和基于摘要的重排名（SR），并提出了一个专门的Decoupling-BEiT-3编码器。",
      "result": "在AToMiC数据集上，CFIR在Recall@1000上比现有MLLMs高出11.06%，同时将训练和检索时间减少了68.75%和99.79%。",
      "audience": "对数字图书馆、电子商务和多媒体数据库等领域感兴趣的研究人员和开发者。",
      "why_keep": "CFIR框架为大规模长文本到图像检索提供了一种高效且准确的方法。",
      "reading_focus": "关注CFIR框架的设计细节和性能评估。"
    }
  },
  {
    "id": "arxiv:2403.09676v1",
    "title": "Unmasking the Shadows of AI: Investigating Deceptive Capabilities in Large Language Models",
    "abstract": "This research critically navigates the intricate landscape of AI deception, concentrating on deceptive behaviours of Large Language Models (LLMs). My objective is to elucidate this issue, examine the discourse surrounding it, and subsequently delve into its categorization and ramifications. The essay initiates with an evaluation of the AI Safety Summit 2023 (ASS) and introduction of LLMs, emphasising multidimensional biases that underlie their deceptive behaviours.The literature review covers four types of deception categorised: Strategic deception, Imitation, Sycophancy, and Unfaithful Reasoning, along with the social implications and risks they entail. Lastly, I take an evaluative stance on various aspects related to navigating the persistent challenges of the deceptive AI. This encompasses considerations of international collaborative governance, the reconfigured engagement of individuals with AI, proposal of practical adjustments, and specific elements of digital education.",
    "authors": [
      {
        "name": "Linge Guo"
      }
    ],
    "year": 2024,
    "publication_date": "2024-02-07",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2403.09676v1",
    "pdf_url": "https://arxiv.org/pdf/2403.09676v1",
    "external_ids": {
      "ArXiv": "2403.09676v1"
    },
    "match_score": 74,
    "read_minutes": 40,
    "source": "arXiv",
    "digest": {
      "verdict": "研究大型语言模型的欺骗能力。",
      "hook": "AI也有欺骗？这篇论文揭露了真相！",
      "problem": "大型语言模型存在欺骗行为，需要深入探讨。",
      "novelty": [
        "评估了AI安全峰会2023及大型语言模型的介绍",
        "分类了四种欺骗类型：战略欺骗、模仿、拍马屁和不当推理",
        "讨论了欺骗行为的社会影响和风险"
      ],
      "method": "调查大型语言模型的欺骗行为，并分析其背后的多维偏见。",
      "result": "提出了国际协作治理、个人与AI的重新配置、实际调整和数字教育等建议。",
      "audience": "对AI安全和伦理感兴趣的读者。",
      "why_keep": "为AI欺骗行为的治理提供了重要参考。",
      "reading_focus": "关注欺骗行为的分类、社会影响和治理建议。"
    }
  },
  {
    "id": "arxiv:2405.11357v3",
    "title": "Large Language Models Lack Understanding of Character Composition of Words",
    "abstract": "Large language models (LLMs) have demonstrated remarkable performances on a wide range of natural language tasks. Yet, LLMs' successes have been largely restricted to tasks concerning words, sentences, or documents, and it remains questionable how much they understand the minimal units of text, namely characters. In this paper, we examine contemporary LLMs regarding their ability to understand character composition of words, and show that most of them fail to reliably carry out even the simple tasks that can be handled by humans with perfection. We analyze their behaviors with comparison to token level performances, and discuss the potential directions for future research.",
    "authors": [
      {
        "name": "Andrew Shin"
      },
      {
        "name": "Kunitake Kaneko"
      }
    ],
    "year": 2024,
    "publication_date": "2024-05-18",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2405.11357v3",
    "pdf_url": "https://arxiv.org/pdf/2405.11357v3",
    "external_ids": {
      "ArXiv": "2405.11357v3"
    },
    "match_score": 75,
    "read_minutes": 39,
    "source": "arXiv",
    "digest": {
      "verdict": "深入分析语言模型对字符理解的不足。",
      "hook": "语言模型不懂汉字？这篇论文揭示了惊人真相！",
      "problem": "大多数语言模型无法可靠地执行人类轻松完成的简单任务。",
      "novelty": [
        "揭示了语言模型对字符组成的理解不足",
        "对比了字符级别和标记级别的表现",
        "讨论了未来研究方向"
      ],
      "method": "分析当代语言模型在理解字符组成方面的能力。",
      "result": "大多数语言模型无法可靠地执行人类轻松完成的简单任务。",
      "audience": "对自然语言处理和人工智能感兴趣的读者。",
      "why_keep": "为未来语言模型的发展提供了重要参考。",
      "reading_focus": "关注字符理解能力的分析及未来研究方向。"
    }
  },
  {
    "id": "arxiv:2501.05032v2",
    "title": "Enhancing Human-Like Responses in Large Language Models",
    "abstract": "This paper explores the advancements in making large language models (LLMs) more human-like. We focus on techniques that enhance natural language understanding, conversational coherence, and emotional intelligence in AI systems. The study evaluates various approaches, including fine-tuning with diverse datasets, incorporating psychological principles, and designing models that better mimic human reasoning patterns. Our findings demonstrate that these enhancements not only improve user interactions but also open new possibilities for AI applications across different domains. Future work will address the ethical implications and potential biases introduced by these human-like attributes.",
    "authors": [
      {
        "name": "Ethem Yağız Çalık"
      },
      {
        "name": "Talha Rüzgar Akkuş"
      }
    ],
    "year": 2025,
    "publication_date": "2025-01-09",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2501.05032v2",
    "pdf_url": "https://arxiv.org/pdf/2501.05032v2",
    "external_ids": {
      "ArXiv": "2501.05032v2"
    },
    "match_score": 74,
    "read_minutes": 38,
    "source": "arXiv",
    "digest": {
      "verdict": "提升语言模型的人类化响应能力。",
      "hook": "让AI更有同理心，这篇论文做到了！",
      "problem": "语言模型在自然语言理解、对话连贯性和情感智能方面仍有不足。",
      "novelty": [
        "通过多样化数据集进行微调",
        "结合心理学原理",
        "设计模仿人类推理模式的模型"
      ],
      "method": "评估各种提升语言模型人类化响应能力的技巧。",
      "result": "提升了用户交互并开辟了AI应用的新可能性。",
      "audience": "对人工智能应用感兴趣的读者。",
      "why_keep": "为AI在各个领域的应用提供了新的方向。",
      "reading_focus": "关注提升人类化响应能力的具体方法和结果。"
    }
  },
  {
    "id": "arxiv:2503.08026v2",
    "title": "In Prospect and Retrospect: Reflective Memory Management for Long-term Personalized Dialogue Agents",
    "abstract": "Large Language Models (LLMs) have made significant progress in open-ended dialogue, yet their inability to retain and retrieve relevant information from long-term interactions limits their effectiveness in applications requiring sustained personalization. External memory mechanisms have been proposed to address this limitation, enabling LLMs to maintain conversational continuity. However, existing approaches struggle with two key challenges. First, rigid memory granularity fails to capture the natural semantic structure of conversations, leading to fragmented and incomplete representations. Second, fixed retrieval mechanisms cannot adapt to diverse dialogue contexts and user interaction patterns. In this work, we propose Reflective Memory Management (RMM), a novel mechanism for long-term dialogue agents, integrating forward- and backward-looking reflections: (1) Prospective Reflection, which dynamically summarizes interactions across granularities-utterances, turns, and sessions-into a personalized memory bank for effective future retrieval, and (2) Retrospective Reflection, which iteratively refines the retrieval in an online reinforcement learning (RL) manner based on LLMs' cited evidence. Experiments show that RMM demonstrates consistent improvement across various metrics and benchmarks. For example, RMM shows more than 10% accuracy improvement over the baseline without memory management on the LongMemEval dataset.",
    "authors": [
      {
        "name": "Zhen Tan"
      },
      {
        "name": "Jun Yan"
      },
      {
        "name": "I-Hung Hsu"
      },
      {
        "name": "Rujun Han"
      },
      {
        "name": "Zifeng Wang"
      },
      {
        "name": "Long T. Le"
      },
      {
        "name": "Yiwen Song"
      },
      {
        "name": "Yanfei Chen"
      },
      {
        "name": "Hamid Palangi"
      },
      {
        "name": "George Lee"
      },
      {
        "name": "Anand Iyer"
      },
      {
        "name": "Tianlong Chen"
      },
      {
        "name": "Huan Liu"
      },
      {
        "name": "Chen-Yu Lee"
      },
      {
        "name": "Tomas Pfister"
      }
    ],
    "year": 2025,
    "publication_date": "2025-03-11",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2503.08026v2",
    "pdf_url": "https://arxiv.org/pdf/2503.08026v2",
    "external_ids": {
      "ArXiv": "2503.08026v2"
    },
    "match_score": 53,
    "read_minutes": 45,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "对话中，LLM如何管理记忆？",
      "problem": "LLM在长期对话中难以保留和检索信息。",
      "novelty": [
        "RMM机制整合前瞻和回顾性反思",
        "动态总结交互，形成个性化记忆库",
        "基于强化学习迭代优化检索"
      ],
      "method": "提出RMM机制，通过前瞻和回顾性反思管理长期对话记忆。",
      "result": "在LongMemEval数据集上比基线提高10%以上。",
      "audience": "对LLM和对话系统感兴趣的研究人员和开发者。",
      "why_keep": "为LLM提供更有效的记忆管理机制。",
      "reading_focus": "RMM机制的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2504.19565v3",
    "title": "Knowledge-Driven Agentic Scientific Corpus Distillation Framework for Biomedical Large Language Models Training",
    "abstract": "Corpus distillation for biomedical large language models (LLMs) seeks to address the pressing challenge of insufficient quantity and quality in open-source annotated scientific corpora, which remains a bottleneck for effective LLM training in biomedical research. This paper proposes a knowledge-driven, agentic framework for scientific corpus distillation, tailored explicitly for LLM training in the biomedical domain, addressing the challenge posed by the complex hierarchy of biomedical knowledge. Central to our approach is a collaborative multi-agent architecture, where specialized agents, each guided by the Medical Subject Headings (MeSH) hierarchy, work in concert to autonomously extract, synthesize, and self-evaluate high-quality textual data from vast scientific literature. This agentic framework collectively generates and refines domain-specific question-answer pairs, ensuring comprehensive coverage and consistency with biomedical ontologies while minimizing manual involvement. Extensive experimental results show that language models trained on our multi-agent distilled datasets achieve notable improvements in biomedical question-answering tasks, outperforming both strong life sciences LLM baselines and advanced proprietary models. Notably, our AI-Ready dataset enables Llama3-70B to surpass GPT-4 with MedPrompt and Med-PaLM-2, despite their larger scale. Detailed ablation studies and case analyses further validate the effectiveness and synergy of each agent within the framework, highlighting the potential of multi-agent collaboration in biomedical LLM training.",
    "authors": [
      {
        "name": "Meng Xiao"
      },
      {
        "name": "Xunxin Cai"
      },
      {
        "name": "Qingqing Long"
      },
      {
        "name": "Chengrui Wang"
      },
      {
        "name": "Yuanchun Zhou"
      },
      {
        "name": "Hengshu Zhu"
      }
    ],
    "year": 2025,
    "publication_date": "2025-04-28",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI",
      "q-bio.QM"
    ],
    "url": "http://arxiv.org/abs/2504.19565v3",
    "pdf_url": "https://arxiv.org/pdf/2504.19565v3",
    "external_ids": {
      "ArXiv": "2504.19565v3"
    },
    "match_score": 72,
    "read_minutes": 46,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "生物医学LLM训练，用多智能体协作提取知识，效率翻倍！",
      "problem": "生物医学领域LLM训练面临开源标注科学语料库数量和质量不足的问题。",
      "novelty": [
        "提出知识驱动的、具有代理能力的科学语料库蒸馏框架",
        "采用协作多智能体架构，每个智能体由MeSH层次结构引导",
        "生成和优化领域特定的问答对"
      ],
      "method": "构建协作多智能体架构，智能体自主提取、综合和自我评估文本数据。",
      "result": "在生物医学问答任务中，模型性能显著提升，超越强基线模型。",
      "audience": "对生物医学LLM训练感兴趣的研究人员和开发者。",
      "why_keep": "为生物医学LLM训练提供了一种高效的知识提取和蒸馏方法。",
      "reading_focus": "关注多智能体架构和实验结果分析。"
    }
  },
  {
    "id": "arxiv:2505.18541v1",
    "title": "RoleRAG: Enhancing LLM Role-Playing via Graph Guided Retrieval",
    "abstract": "Large Language Models (LLMs) have shown promise in character imitation, enabling immersive and engaging conversations. However, they often generate content that is irrelevant or inconsistent with a character's background. We attribute these failures to: (1) the inability to accurately recall character-specific knowledge due to entity ambiguity, and (2) a lack of awareness of the character's cognitive boundaries. To address these issues, we propose RoleRAG, a retrieval-based framework that integrates efficient entity disambiguation for knowledge indexing with a boundary-aware retriever for extracting contextually appropriate information from a structured knowledge graph. Experiments on role-playing benchmarks show that RoleRAG's calibrated retrieval helps both general-purpose and role-specific LLMs better align with character knowledge and reduce hallucinated responses.",
    "authors": [
      {
        "name": "Yongjie Wang"
      },
      {
        "name": "Jonathan Leung"
      },
      {
        "name": "Zhiqi Shen"
      }
    ],
    "year": 2025,
    "publication_date": "2025-05-24",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2505.18541v1",
    "pdf_url": "https://arxiv.org/pdf/2505.18541v1",
    "external_ids": {
      "ArXiv": "2505.18541v1"
    },
    "match_score": 52,
    "read_minutes": 40,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "角色扮演，RoleRAG帮你更懂角色。",
      "problem": "LLM在角色模仿中生成的内容可能与角色背景不相关或不一致。",
      "novelty": [
        "RoleRAG框架，结合高效的实体消歧和边界感知检索器。",
        "实体消歧用于知识索引，边界感知检索器从结构化知识图中提取上下文适当的信息。"
      ],
      "method": "RoleRAG框架，通过图引导检索增强LLM的角色扮演。",
      "result": "RoleRAG的校准检索帮助LLM更好地与角色知识对齐，并减少幻觉响应。",
      "audience": "对LLM角色扮演和知识检索感兴趣的研究人员和工程师。",
      "why_keep": "为LLM角色扮演领域提供了新的检索框架。",
      "reading_focus": "关注RoleRAG框架的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2508.09736v4",
    "title": "Seeing, Listening, Remembering, and Reasoning: A Multimodal Agent with Long-Term Memory",
    "abstract": "We introduce M3-Agent, a novel multimodal agent framework equipped with long-term memory. Like humans, M3-Agent can process real-time visual and auditory inputs to build and update episodic and semantic memories, gradually accumulating world knowledge. Its memory is organized in an entity-centric, multimodal manner, enabling deeper and more consistent understanding of the environment. Given an instruction, M3-Agent autonomously performs multi-turn reasoning and retrieves relevant memories to complete tasks. To evaluate memory effectiveness and memory-based reasoning in multimodal agents, we develop M3-Bench, a long-video question answering benchmark comprising 100 newly recorded robot-perspective videos (M3-Bench-robot) and 920 diverse web-sourced videos (M3-Bench-web). We annotate QA pairs designed to test capabilities essential for agent applications, such as person understanding, general knowledge extraction, and cross-modal reasoning. Experimental results show that M3-Agent, trained via reinforcement learning, outperforms the strongest baseline, a prompting agent using Gemini-1.5-pro and GPT-4o, achieving 6.7%, 7.7%, and 5.3% higher accuracy on M3-Bench-robot, M3-Bench-web and VideoMME-long, respectively. Our work advances multimodal agents toward more human-like long-term memory and provides insights for their practical design. Model, code and data are available at https://github.com/bytedance-seed/m3-agent.",
    "authors": [
      {
        "name": "Lin Long"
      },
      {
        "name": "Yichen He"
      },
      {
        "name": "Wentao Ye"
      },
      {
        "name": "Yiyuan Pan"
      },
      {
        "name": "Yuan Lin"
      },
      {
        "name": "Hang Li"
      },
      {
        "name": "Junbo Zhao"
      },
      {
        "name": "Wei Li"
      }
    ],
    "year": 2025,
    "publication_date": "2025-08-13",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CV"
    ],
    "url": "http://arxiv.org/abs/2508.09736v4",
    "pdf_url": "https://arxiv.org/pdf/2508.09736v4",
    "external_ids": {
      "ArXiv": "2508.09736v4"
    },
    "match_score": 70,
    "read_minutes": 44,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "记忆大师上线！多模态智能体M3-Agent，看、听、记、推理样样精通",
      "problem": "多模态智能体在处理长期记忆和推理任务时，存在记忆不一致和理解深度不足的问题。",
      "novelty": [
        "M3-Agent具备长期记忆能力，能够处理视觉和听觉输入。",
        "采用实体中心的多模态记忆组织方式。",
        "M3-Bench基准测试展示了M3-Agent在多模态问答上的优越性能。"
      ],
      "method": "M3-Agent通过强化学习训练，并使用M3-Bench进行评估。",
      "result": "在M3-Bench-robot、M3-Bench-web和VideoMME-long上分别比基线模型高出6.7%、7.7%和5.3%的准确率。",
      "audience": "对多模态智能体和长期记忆研究感兴趣的读者。",
      "why_keep": "为多模态智能体的长期记忆和推理提供了新的思路和方法。",
      "reading_focus": "关注M3-Agent的记忆组织方式和M3-Bench基准测试的结果。"
    }
  },
  {
    "id": "arxiv:2510.06426v1",
    "title": "FinLFQA: Evaluating Attributed Text Generation of LLMs in Financial Long-Form Question Answering",
    "abstract": "Large Language Models (LLMs) frequently hallucinate to long-form questions, producing plausible yet factually incorrect answers. A common mitigation strategy is to provide attribution to LLM outputs. However, existing benchmarks primarily focus on simple attribution that retrieves supporting textual evidence as references. We argue that in real-world scenarios such as financial applications, attribution goes beyond reference retrieval. We introduce FinLFQA, a benchmark designed to evaluate the ability of LLMs to generate long-form answers to complex financial questions with reliable and nuanced attributions. FinLFQA evaluates three critical aspects of attribution through human annotations: (1) supporting evidence extracted from financial reports, (2) intermediate numerical reasoning steps, and (3) domain-specific financial knowledge that informs the reasoning process. We further provide an automatic evaluation framework covering both answer quality and attribution quality. Through extensive experiments on eight LLMs across multiple attribution-generation paradigms, we find that fine-grained metrics are important to distinguish model capabilities, that end-to-end generation achieves comparable performance to post-hoc approaches, and that iterative refinement only helps when guided by external feedback.",
    "authors": [
      {
        "name": "Yitao Long"
      },
      {
        "name": "Tiansheng Hu"
      },
      {
        "name": "Yilun Zhao"
      },
      {
        "name": "Arman Cohan"
      },
      {
        "name": "Chen Zhao"
      }
    ],
    "year": 2025,
    "publication_date": "2025-10-07",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL"
    ],
    "url": "http://arxiv.org/abs/2510.06426v1",
    "pdf_url": "https://arxiv.org/pdf/2510.06426v1",
    "external_ids": {
      "ArXiv": "2510.06426v1"
    },
    "match_score": 56,
    "read_minutes": 44,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "金融问答，LLM如何避免胡说八道？",
      "problem": "LLM在生成长篇问答时经常出现事实错误。",
      "novelty": [
        "FinLFQA，评估LLM在金融长篇问答中的归因能力",
        "通过人类标注评估三个关键归因方面：支持证据、推理步骤和领域知识",
        "提供自动评估框架，涵盖答案质量和归因质量"
      ],
      "method": "设计FinLFQA基准，进行多LLM和归因生成范式实验。",
      "result": "发现细粒度指标对于区分模型能力很重要，端到端生成与后处理方法性能相当。",
      "audience": "对金融问答和LLM归因感兴趣的读者。",
      "why_keep": "为LLM在金融领域的应用提供了重要的基准和评估框架。",
      "reading_focus": "关注FinLFQA基准的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2510.09720v1",
    "title": "Preference-Aware Memory Update for Long-Term LLM Agents",
    "abstract": "One of the key factors influencing the reasoning capabilities of LLM-based agents is their ability to leverage long-term memory. Integrating long-term memory mechanisms allows agents to make informed decisions grounded in historical interactions. While recent advances have significantly improved the storage and retrieval components, by encoding memory into dense vectors for similarity search or organizing memory as structured knowledge graphs most existing approaches fall short in memory updating. In particular, they lack mechanisms for dynamically refining preference memory representations in response to evolving user behaviors and contexts. To address this gap, we propose a Preference-Aware Memory Update Mechanism (PAMU) that enables dynamic and personalized memory refinement. By integrating sliding window averages (SW) with exponential moving averages (EMA), PAMU constructs a fused preference-aware representation that captures both short-term fluctuations and long-term user tendencies. We conduct experiments on five task scenarios of the LoCoMo dataset, and the results show that our mechanism can significantly improve the output quality of LLM in five baselines, validating its effectiveness in long-term conversations.",
    "authors": [
      {
        "name": "Haoran Sun"
      },
      {
        "name": "Zekun Zhang"
      },
      {
        "name": "Shaoning Zeng"
      }
    ],
    "year": 2025,
    "publication_date": "2025-10-10",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2510.09720v1",
    "pdf_url": "https://arxiv.org/pdf/2510.09720v1",
    "external_ids": {
      "ArXiv": "2510.09720v1"
    },
    "match_score": 75,
    "read_minutes": 43,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "记忆升级，LLM智能体不再忘事——个性化记忆优化，对话更流畅",
      "problem": "现有LLM智能体在长期记忆更新方面存在不足，难以适应用户行为和情境的变化。",
      "novelty": [
        "提出**Preference-Aware Memory Update Mechanism (PAMU**)，动态优化记忆表示。",
        "融合**滑动窗口平均 (SW**)和**指数移动平均 (EMA**)，捕捉短期波动和长期趋势。",
        "在五个任务场景中，显著提升LLM输出质量。"
      ],
      "method": "设计PAMU机制，结合SW和EMA构建偏好感知表示。",
      "result": "在五个基线中，机制显著提升LLM输出质量。",
      "audience": "对LLM智能体长期记忆优化感兴趣的读者。",
      "why_keep": "为LLM智能体长期记忆更新提供了一种有效的方法。",
      "reading_focus": "关注PAMU机制的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2603.00026v2",
    "title": "ActMem: Bridging the Gap Between Memory Retrieval and Reasoning in LLM Agents",
    "abstract": "Memory management is essential for LLM agents in long-term interactions. Current memory frameworks typically treat agents as passive ``recorders'' and retrieve information without understanding its deeper implications. They may fail in scenarios requiring reasoning and complex decision-making. To bridge this critical gap, we propose a novel actionable memory framework called ActMem that integrates memory retrieval with active causal reasoning. ActMem transforms unstructured dialogue history into a structured causal and semantic graph. By leveraging counterfactual reasoning and commonsense completion, it enables agents to deduce implicit constraints and resolve potential conflicts between past states and current intentions. Furthermore, we introduce a comprehensive dataset ActMemEval to evaluate agent reasoning capabilities in logic-driven scenarios, moving beyond the fact-retrieval focus of existing memory benchmarks. Experiments demonstrate that ActMem significantly outperforms baselines in handling complex, memory-dependent tasks, paving the way for more consistent and reliable intelligent assistants.",
    "authors": [
      {
        "name": "Xiaohui Zhang"
      },
      {
        "name": "Zequn Sun"
      },
      {
        "name": "Chengyuan Yang"
      },
      {
        "name": "Yaqin Jin"
      },
      {
        "name": "Yazhong Zhang"
      },
      {
        "name": "Wei Hu"
      }
    ],
    "year": 2026,
    "publication_date": "2026-02-04",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CL",
      "cs.AI",
      "cs.IR"
    ],
    "url": "http://arxiv.org/abs/2603.00026v2",
    "pdf_url": "https://arxiv.org/pdf/2603.00026v2",
    "external_ids": {
      "ArXiv": "2603.00026v2"
    },
    "match_score": 54,
    "read_minutes": 41,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "记忆与推理，LLM智能助手更靠谱了！",
      "problem": "现有记忆框架在推理和复杂决策中表现不佳。",
      "novelty": [
        "ActMem框架结合记忆检索与因果推理",
        "将对话历史转化为语义图",
        "引入ActMemEval数据集评估推理能力"
      ],
      "method": "提出ActMem框架，将对话历史转化为语义图，并利用反事实推理和常识补全。",
      "result": "在复杂任务上显著优于基线。",
      "audience": "对LLM智能助手和对话系统感兴趣的研究人员和开发者。",
      "why_keep": "为LLM智能助手提供更可靠的记忆管理。",
      "reading_focus": "ActMem框架的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2603.02888v1",
    "title": "LLandMark: A Multi-Agent Framework for Landmark-Aware Multimodal Interactive Video Retrieval",
    "abstract": "The increasing diversity and scale of video data demand retrieval systems capable of multimodal understanding, adaptive reasoning, and domain-specific knowledge integration. This paper presents LLandMark, a modular multi-agent framework for landmark-aware multimodal video retrieval to handle real-world complex queries. The framework features specialized agents that collaborate across four stages: query parsing and planning, landmark reasoning, multimodal retrieval, and reranked answer synthesis. A key component, the Landmark Knowledge Agent, detects cultural or spatial landmarks and reformulates them into descriptive visual prompts, enhancing CLIP-based semantic matching for Vietnamese scenes. To expand capabilities, we introduce an LLM-assisted image-to-image pipeline, where a large language model (Gemini 2.5 Flash) autonomously detects landmarks, generates image search queries, retrieves representative images, and performs CLIP-based visual similarity matching, removing the need for manual image input. In addition, an OCR refinement module leveraging Gemini and LlamaIndex improves Vietnamese text recognition. Experimental results show that LLandMark achieves adaptive, culturally grounded, and explainable retrieval performance.",
    "authors": [
      {
        "name": "Minh-Chi Phung"
      },
      {
        "name": "Thien-Bao Le"
      },
      {
        "name": "Cam-Tu Tran-Thi"
      },
      {
        "name": "Thu-Dieu Nguyen-Thi"
      },
      {
        "name": "Vu-Hung Dao"
      }
    ],
    "year": 2026,
    "publication_date": "2026-03-03",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CV"
    ],
    "url": "http://arxiv.org/abs/2603.02888v1",
    "pdf_url": "https://arxiv.org/pdf/2603.02888v1",
    "external_ids": {
      "ArXiv": "2603.02888v1"
    },
    "match_score": 52,
    "read_minutes": 42,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "视频检索也能懂文化，LLandMark帮你找到越南风景里的地标。",
      "problem": "视频数据多样性和规模增加，需要能够进行多模态理解、自适应推理和特定领域知识集成的检索系统。",
      "novelty": [
        "LLandMark，一个模块化的多智能体框架，用于地标感知的多模态视频检索。",
        "Landmark Knowledge Agent，检测文化或空间地标，并将其重新表述为描述性视觉提示。",
        "LLM-assisted image-to-image pipeline，无需手动图像输入。"
      ],
      "method": "提出LLandMark框架，包括查询解析和规划、地标推理、多模态检索和重排序答案合成。",
      "result": "LLandMark实现了自适应、文化基础和可解释的检索性能。",
      "audience": "对视频检索和多模态理解感兴趣的研究人员和工程师。",
      "why_keep": "为视频检索领域提供了新的多智能体框架。",
      "reading_focus": "关注LLandMark框架的架构和实验结果。"
    }
  },
  {
    "id": "arxiv:2604.07863v1",
    "title": "Task-Adaptive Retrieval over Agentic Multi-Modal Web Histories via Learned Graph Memory",
    "abstract": "Retrieving relevant observations from long multi-modal web interaction histories is challenging because relevance depends on the evolving task state, modality (screenshots, HTML text, structured signals), and temporal distance. Prior approaches typically rely on static similarity thresholds or fixed-capacity buffers, which fail to adapt relevance to the current task context. We propose \\textbf{ACGM}, a learned graph-memory retriever that constructs \\emph{task-adaptive} relevance graphs over agent histories using policy-gradient optimization from downstream task success. ACGM captures heterogeneous temporal dynamics with modality-specific decay (visual decays $4.3\\times$ faster than text: $λ_v{=}0.47$ vs.\\ $λ_x{=}0.11$) and learns sparse connectivity (3.2 edges/node), enabling efficient $O(\\log T)$ retrieval. Across WebShop, VisualWebArena, and Mind2Web, ACGM improves retrieval quality to \\textbf{82.7 nDCG@10} (+9.3 over GPT-4o, $p{<}0.001$) and \\textbf{89.2\\% Precision@10} (+7.7), outperforming 19 strong dense, re-ranking, multi-modal, and graph-based baselines. Code to reproduce our results is available at{\\color{blue}\\href{https://github.com/S-Forouzandeh/ACGM-Agentic-Web}{Saman Forouzandeh}}.",
    "authors": [
      {
        "name": "Saman Forouzandeh"
      },
      {
        "name": "Kamal Berahmand"
      },
      {
        "name": "Mahdi Jalili"
      }
    ],
    "year": 2026,
    "publication_date": "2026-04-09",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2604.07863v1",
    "pdf_url": "https://arxiv.org/pdf/2604.07863v1",
    "external_ids": {
      "ArXiv": "2604.07863v1"
    },
    "match_score": 55,
    "read_minutes": 41,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "多模态历史，如何让机器更懂任务？",
      "problem": "从长多模态网络交互历史中检索相关观察结果具有挑战性。",
      "novelty": [
        "提出ACGM，学习图记忆检索器，构建任务自适应相关性图",
        "捕获异构时间动态，具有模态特定的衰减和稀疏连接",
        "在多个数据集上优于19个基线"
      ],
      "method": "使用策略梯度优化从下游任务成功中构建任务自适应相关性图。",
      "result": "ACGM在检索质量上显著优于基线，达到82.7 nDCG@10和89.2% Precision@10。",
      "audience": "对多模态信息检索和图记忆感兴趣的读者。",
      "why_keep": "为多模态信息检索提供了新的方法和思路。",
      "reading_focus": "关注ACGM的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2604.08224v1",
    "title": "Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering",
    "abstract": "Large language model (LLM) agents are increasingly built less by changing model weights than by reorganizing the runtime around them. Capabilities that earlier systems expected the model to recover internally are now externalized into memory stores, reusable skills, interaction protocols, and the surrounding harness that makes these modules reliable in practice. This paper reviews that shift through the lens of externalization. Drawing on the idea of cognitive artifacts, we argue that agent infrastructure matters not merely because it adds auxiliary components, but because it transforms hard cognitive burdens into forms that the model can solve more reliably. Under this view, memory externalizes state across time, skills externalize procedural expertise, protocols externalize interaction structure, and harness engineering serves as the unification layer that coordinates them into governed execution. We trace a historical progression from weights to context to harness, analyze memory, skills, and protocols as three distinct but coupled forms of externalization, and examine how they interact inside a larger agent system. We further discuss the trade-off between parametric and externalized capability, identify emerging directions such as self-evolving harnesses and shared agent infrastructure, and discuss open challenges in evaluation, governance, and the long-term co-evolution of models and external infrastructure. The result is a systems-level framework for explaining why practical agent progress increasingly depends not only on stronger models, but on better external cognitive infrastructure.",
    "authors": [
      {
        "name": "Chenyu Zhou"
      },
      {
        "name": "Huacan Chai"
      },
      {
        "name": "Wenteng Chen"
      },
      {
        "name": "Zihan Guo"
      },
      {
        "name": "Rong Shan"
      },
      {
        "name": "Yuanyi Song"
      },
      {
        "name": "Tianyi Xu"
      },
      {
        "name": "Yingxuan Yang"
      },
      {
        "name": "Aofan Yu"
      },
      {
        "name": "Weiming Zhang"
      },
      {
        "name": "Congming Zheng"
      },
      {
        "name": "Jiachen Zhu"
      },
      {
        "name": "Zeyu Zheng"
      },
      {
        "name": "Zhuosheng Zhang"
      },
      {
        "name": "Xingyu Lou"
      },
      {
        "name": "Changwang Zhang"
      },
      {
        "name": "Zhihui Fu"
      },
      {
        "name": "Jun Wang"
      },
      {
        "name": "Weiwen Liu"
      },
      {
        "name": "Jianghao Lin"
      },
      {
        "name": "Weinan Zhang"
      }
    ],
    "year": 2026,
    "publication_date": "2026-04-09",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.SE",
      "cs.MA"
    ],
    "url": "http://arxiv.org/abs/2604.08224v1",
    "pdf_url": "https://arxiv.org/pdf/2604.08224v1",
    "external_ids": {
      "ArXiv": "2604.08224v1"
    },
    "match_score": 64,
    "read_minutes": 48,
    "source": "arXiv",
    "digest": {
      "verdict": "深度阅读",
      "hook": "LLM智能体进化了！从模型权重到外部认知基础设施，看它们如何升级",
      "problem": "LLM智能体在构建和运行时，过度依赖模型权重调整，限制了其能力的发展。",
      "novelty": [
        "外部化将认知负担转化为模型可依赖的形式。",
        "记忆、技能、协议和外部化工程是外部化的三种形式。",
        "外部化工程作为统一层，协调各模块执行。"
      ],
      "method": "通过外部化将能力从模型内部转移到外部存储和模块中。",
      "result": "提供了系统级框架，解释了智能体进步依赖于更强的模型和更好的外部认知基础设施。",
      "audience": "对LLM智能体和认知科学感兴趣的读者。",
      "why_keep": "为LLM智能体的设计和评估提供了新的视角。",
      "reading_focus": "关注外部化概念及其在智能体系统中的应用。"
    }
  },
  {
    "id": "arxiv:2605.06924v1",
    "title": "A$^2$RD: Agentic Autoregressive Diffusion for Long Video Consistency",
    "abstract": "Synthesizing consistent and coherent long video remains a fundamental challenge. Existing methods suffer from semantic drift and narrative collapse over long horizons. We present A$^2$RD, an Agentic Auto-Regressive Diffusion architecture that decouples creative synthesis from consistency enforcement. A$^2$RD formulates long video synthesis as a closed-loop process that synthesizes and self-improves video segment-by-segment through a Retrieve--Synthesize--Refine--Update cycle. It comprises three core components: (i) Multimodal Video Memory that tracks video progression across modalities; (ii) Adaptive Segment Generation that switches among generation modes for natural progression and visual consistency; and (iii) Hierarchical Test-Time Self-Improvement that self-improves each segment at frame and video levels to prevent error propagation. We further introduce LVBench-C, a challenging benchmark with non-linear entity and environment transitions to stress-test long-horizon consistency. Across public and LVBench-C benchmarks spanning one- to ten-minute videos, A$^2$RD outperforms state-of-the-art baselines by up to 30% in consistency and 20% in narrative coherence. Human evaluations corroborate these gains while also highlighting notable improvements in motion and transition smoothness.",
    "authors": [
      {
        "name": "Do Xuan Long"
      },
      {
        "name": "Yale Song"
      },
      {
        "name": "Min-Yen Kan"
      },
      {
        "name": "Tomas Pfister"
      },
      {
        "name": "Long T. Le"
      }
    ],
    "year": 2026,
    "publication_date": "2026-05-07",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CV",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2605.06924v1",
    "pdf_url": "https://arxiv.org/pdf/2605.06924v1",
    "external_ids": {
      "ArXiv": "2605.06924v1"
    },
    "match_score": 60,
    "read_minutes": 43,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "长视频生成，这篇论文让画面连贯又自然！",
      "problem": "现有方法在长视频合成中存在语义漂移和叙事崩溃问题。",
      "novelty": [
        "提出A$^2$RD架构，将创意合成与一致性执行解耦。",
        "A$^2$RD通过检索-合成-细化-更新循环实现视频段段合成。",
        "引入LVBench-C基准测试，用于测试长视频的一致性。"
      ],
      "method": "A$^2$RD通过解耦创意合成与一致性执行，实现视频段段合成，并引入LVBench-C基准测试。",
      "result": "在公共和LVBench-C基准测试中，A$^2$RD在一致性和叙事连贯性方面优于现有基线，分别提高了30%和20%。",
      "audience": "对长视频生成和视频处理技术感兴趣的研究人员和开发者。",
      "why_keep": "A$^2$RD为长视频生成提供了一种有效且高效的方法。",
      "reading_focus": "关注A$^2$RD架构的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2605.18805v1",
    "title": "RecoAtlas: From Semantic Plausibility to Set-Level Utility in LLM Recommendation Agents",
    "abstract": "LLM recommendation agents increasingly produce structured recommendation reports: sets of items accompanied by natural-language justifications. Yet existing evaluations often reduce this setting to reranking small shortlisted candidate sets or judge reports mainly by semantic plausibility. We introduce Recommendation Atlas (Agentic Tool-Level Assessment for Shopping), or RecoAtlas, a benchmark and toolkit for evaluating shopping agents with behavior-grounded metrics. RecoAtlas complements held-out interaction metrics with learned utility proxies for relevance, complementarity, and diversity derived from interaction data, while separately measuring semantic coherence and explanation quality. Its controlled tool environment exposes agents to either semantic, behavior-aligned, or faulty tools, enabling diagnosis of whether performance gains arise from stronger reasoning, better signals, or more effective tool-use policies. Across controlled experiments, we show that RecoAtlas exhibits key properties of a meaningful benchmark for agentic systems: performance scales with model capacity and test-time compute, improves with stronger and better-aligned tools, degrades under noisy or misaligned signals, and reveals that semantic plausibility does not necessarily capture behavior-grounded utility. RecoAtlas provides a foundation for developing and evaluating shopping assistants that optimize not only for plausible recommendations, but also for coherent, behaviorally grounded recommendation sets.",
    "authors": [
      {
        "name": "Imad Aouali"
      },
      {
        "name": "Flavian Vasile"
      },
      {
        "name": "Otmane Sakhi"
      },
      {
        "name": "Alexandre Gilotte"
      },
      {
        "name": "Benjamin Heymann"
      }
    ],
    "year": 2026,
    "publication_date": "2026-05-11",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR",
      "cs.AI",
      "cs.LG"
    ],
    "url": "http://arxiv.org/abs/2605.18805v1",
    "pdf_url": "https://arxiv.org/pdf/2605.18805v1",
    "external_ids": {
      "ArXiv": "2605.18805v1"
    },
    "match_score": 52,
    "read_minutes": 45,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "购物助手推荐不再只看表面，这篇论文教你挖掘深层价值。",
      "problem": "现有评估方法常将推荐报告简化为候选集重排序或仅凭语义合理性判断。",
      "novelty": [
        "引入RecoAtlas，一个基于行为指标的购物代理评估基准和工具包。",
        "通过学习效用代理，补充了保留交互指标。",
        "测量语义一致性和解释质量，并暴露代理于不同工具环境。"
      ],
      "method": "RecoAtlas通过行为指标评估购物代理，并使用效用代理补充保留交互指标。",
      "result": "RecoAtlas揭示了语义合理性并不一定能捕捉基于行为的价值。",
      "audience": "对购物助手推荐系统感兴趣的研究人员和开发者。",
      "why_keep": "为购物助手提供了评估和优化的新基准。",
      "reading_focus": "关注RecoAtlas如何评估代理性能和效用代理的使用。"
    }
  },
  {
    "id": "arxiv:2605.27437v1",
    "title": "MGRetrieval: Memory-Guided Reflective Retrieval for Long-Term Dialogue Agents",
    "abstract": "Large Language Models (LLMs) have made significant progress in dialogue, yet redundant memory contexts severely limit their effectiveness in long-term dialogue agents. External memory systems have been proposed to improve memory maintenance. However, these systems mainly rely on one-shot retrieval, which limits their ability to retrieve sufficient and relevant evidence. Although recent methods introduce reflection into retrieval, their retrieval paths are generated by the LLM from limited evidence, leading to unstable retrieval and additional latency overhead. %These limitations highlight the need for effective retrieval mechanisms. To address these limitations, we propose MGRetrieval, a retrieval strategy that grounds reflective retrieval in the semantic structure of historical memories. Specifically, MGRetrieval consists of two steps: (1) It references the structure of historical memories to construct a more precise retrieval path. (2) The LLM retains critical memories and determines whether accumulated memories are sufficient to stop further iterative retrieval. This allows the retrieval process to follow semantically meaningful paths. Through memory-guided retrieval and critical memory propagation, MGRetrieval gradually constructs concise and sufficient memory contexts. Extensive experiments on LoCoMo show that MGRetrieval outperforms the strongest baseline by 8.91\\% in F1 and 11.11\\% in BLEU-1 on average across Qwen2.5-14B and Qwen3-14B, while maintaining practical token and latency costs. The code can be found in https://anonymous.4open.science/r/MGRetrieval.",
    "authors": [
      {
        "name": "Tan Wang"
      },
      {
        "name": "Yunwei Dong"
      }
    ],
    "year": 2026,
    "publication_date": "2026-05-22",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.IR",
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2605.27437v1",
    "pdf_url": "https://arxiv.org/pdf/2605.27437v1",
    "external_ids": {
      "ArXiv": "2605.27437v1"
    },
    "match_score": 65,
    "read_minutes": 47,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "对话机器人记忆升级！MGRetrieval让对话更连贯",
      "problem": "长期对话智能体在记忆维护和检索上存在效率低下和稳定性不足的问题。",
      "novelty": [
        "MGRetrieval基于历史记忆的语义结构进行检索。",
        "通过记忆引导的检索和关键记忆传播，构建简洁且充分的记忆上下文。",
        "在LoCoMo基准测试中，MGRetrieval在F1和BLEU-1上平均比最强基线高出8.91%和11.11%。"
      ],
      "method": "提出MGRetrieval，一种基于语义结构的记忆引导检索策略。",
      "result": "MGRetrieval在LoCoMo基准测试中，平均比最强基线高出8.91%的F1和11.11%的BLEU-1。",
      "audience": "对对话系统和长期记忆研究感兴趣的读者。",
      "why_keep": "为长期对话智能体的记忆维护和检索提供了有效的解决方案。",
      "reading_focus": "关注MGRetrieval的检索策略和实验结果。"
    }
  },
  {
    "id": "arxiv:2606.06036v1",
    "title": "Memory is Reconstructed, Not Retrieved: Graph Memory for LLM Agents",
    "abstract": "Despite recent progress, LLM agents still struggle with reasoning over long interaction histories. While current memory-augmented agents rely on a static retrieve-then-reason paradigm, this rigid pipeline design prevents them from dynamically adapting memory access to intermediate evidence discovered during inference. To bridge this gap, we propose MRAgent, a framework that combines an associative memory graph with an active reconstruction mechanism. We represent memory as a Cue-Tag-Content graph, where associative tags serve as semantic bridges connecting fine-grained cues to memory contents. Operating on this structure, our active reconstruction mechanism integrates LLM reasoning directly into memory access, allowing the agent to iteratively explore and prune retrieval paths based on accumulated evidence. This ensures that memory retrieval is dynamically adapted to the reasoning context while avoiding combinatorial explosion caused by unconstrained expansion. Experiments on the LoCoMo benchmark and LongMemEval benchmark demonstrate significant improvements over strong baselines (up to 23%), while substantially reducing token and runtime cost, highlighting the effectiveness of active and associative reconstruction for long-horizon memory reasoning.",
    "authors": [
      {
        "name": "Shuo Ji"
      },
      {
        "name": "Yibo Li"
      },
      {
        "name": "Bryan Hooi"
      }
    ],
    "year": 2026,
    "publication_date": "2026-06-04",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.AI",
      "cs.IR"
    ],
    "url": "http://arxiv.org/abs/2606.06036v1",
    "pdf_url": "https://arxiv.org/pdf/2606.06036v1",
    "external_ids": {
      "ArXiv": "2606.06036v1"
    },
    "match_score": 62,
    "read_minutes": 43,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "LLM智能体记忆重建，不再是检索难题！",
      "problem": "现有记忆增强智能体依赖于静态的检索-推理范式，无法动态适应推理过程中的中间证据。",
      "novelty": [
        "提出MRAgent框架，结合关联记忆图和主动重建机制。",
        "使用Cue-Tag-Content图表示记忆，关联标签作为语义桥梁。",
        "将LLM推理直接集成到记忆访问中。"
      ],
      "method": "MRAgent通过关联记忆图和主动重建机制，将LLM推理直接集成到记忆访问中。",
      "result": "在LoCoMo和LongMemEval基准测试中，MRAgent比强基线提高了23%，同时显著降低了token和运行时成本。",
      "audience": "对LLM智能体和记忆增强技术感兴趣的研究人员。",
      "why_keep": "MRAgent为LLM智能体的长期记忆推理提供了一种有效的方法。",
      "reading_focus": "关注MRAgent框架的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2606.17328v1",
    "title": "MemTrace: Probing What Final Accuracy Misses in Long-Term Memory",
    "abstract": "LLM agents increasingly maintain long-term memory of user facts across sessions. Yet such memory is usually evaluated by aggregating accuracy over question rows or episodes. Because this approach scores question rows independently, even when several questions probe the same fact, it cannot show how that fact behaves as conditions change. We introduce MemTrace, a benchmark whose unit of measurement is the knowledge point: a single typed fact about the user, rather than an individual question. MemTrace probes each fact along three controlled dimensions: memory age, defined by how many sessions ago the fact appeared in the history; question type, covering current state, earlier state, and trajectory of change; and evidence condition, covering present, missing, and contradicted-by-false-premise settings. Evaluating 13 memory-system configurations across four paradigms, we find that similar pooled accuracy hides different failures: recovering a fact's current and earlier states does not imply tracking how it changed, and safe abstention does not imply correcting a false premise. The dominant bottleneck is evidence use, not retrieval: when systems fail, the evidence was retrievable 10 times more often than it was missing. These results suggest that improving long-term memory requires better use of reachable evidence, not simply more storage or retrieval.",
    "authors": [
      {
        "name": "Xianxuan Long"
      },
      {
        "name": "Zhikai Chen"
      },
      {
        "name": "Shenglai Zeng"
      },
      {
        "name": "Shouren Wang"
      },
      {
        "name": "Kai Guo"
      },
      {
        "name": "Jiliang Tang"
      }
    ],
    "year": 2026,
    "publication_date": "2026-06-15",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.AI"
    ],
    "url": "http://arxiv.org/abs/2606.17328v1",
    "pdf_url": "https://arxiv.org/pdf/2606.17328v1",
    "external_ids": {
      "ArXiv": "2606.17328v1"
    },
    "match_score": 71,
    "read_minutes": 46,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "LLM记忆深度探查，不只是准确率那么简单——MemTrace揭示记忆的细微差别",
      "problem": "现有LLM智能体长期记忆评估方法存在局限性，无法全面反映记忆行为。",
      "novelty": [
        "提出**MemTrace**，以知识点为单位评估记忆。",
        "从记忆年龄、问题类型和证据条件三个维度进行评估。",
        "发现证据使用是主要瓶颈，而非检索。"
      ],
      "method": "设计MemTrace基准，从多个维度评估LLM智能体长期记忆。",
      "result": "发现证据使用是主要瓶颈，而非检索。",
      "audience": "对LLM智能体长期记忆评估感兴趣的读者。",
      "why_keep": "为LLM智能体长期记忆评估提供了一种新的视角。",
      "reading_focus": "关注MemTrace基准的设计和实验结果。"
    }
  },
  {
    "id": "arxiv:2606.24322v1",
    "title": "Securing LLM-Agent Long-Term Memory Against Poisoning: Non-Malleable, Origin-Bound Authority with Machine-Checked Guarantees",
    "abstract": "LLM agents increasingly rely on persistent long-term memory, which creates a critical vulnerability that we study here: memory poisoning. An adversary can store untrusted content in one session that later steers a consequential action, such as a payment, a setting change, or data exfiltration, in a future session. Existing defenses base a memory item's authority to act on either its content (detection or trust-scoring) or its derivation history (lineage). We show that both signals are malleable. An attacker can launder an untrusted origin through three channels specific to LLM agents: the agent's own summarization, a trusted-tool echo, and manufactured corroboration. Each makes the content look benign and breaks or flips its derivation edge to ``trusted.'' We formalize malleability for the memory write-retrieve-act pipeline and prove a machine-checked separation theorem. No content- or lineage-based defense is sound under laundering (T1), write-time origin binding is necessary (T2), and non-malleable origin-bound authority with Sybil-resistant corroboration-gated elevation is sufficient (T3). Our construction, TMA-NM (Tamper-evident Memory Authority, Non-Malleable), instantiates non-malleable information-flow control (IFC) for LLM-agent memory. A cross-defense, cross-attack, and cross-model benchmark over eight frontier models shows that existing defenses fail exactly where the theory predicts (up to 68% laundering attack-success), while TMA-NM reaches 0% attack success on both direct and laundering attacks across all models and channels, at full legitimate utility. We release the benchmark, harness, and machine-checked TLA+ models to support reproducibility.",
    "authors": [
      {
        "name": "Yedidel Louck"
      }
    ],
    "year": 2026,
    "publication_date": "2026-06-23",
    "venue": "arXiv",
    "citation_count": 0,
    "influential_citation_count": 0,
    "fields": [
      "cs.CR"
    ],
    "url": "http://arxiv.org/abs/2606.24322v1",
    "pdf_url": "https://arxiv.org/pdf/2606.24322v1",
    "external_ids": {
      "ArXiv": "2606.24322v1"
    },
    "match_score": 74,
    "read_minutes": 49,
    "source": "arXiv",
    "digest": {
      "verdict": "推荐阅读",
      "hook": "LLM智能体记忆安全，防毒攻略来了——非可变、原生日志，机器验证保障",
      "problem": "LLM智能体长期记忆易受毒化攻击，存在安全隐患。",
      "novelty": [
        "提出**TMA-NM (Tamper-evident Memory Authority, Non-Malleable**)，实现不可变信息流控制。",
        "证明非可变原生日志权威机制在防止毒化攻击中的有效性。",
        "在八种前沿模型上，TMA-NM在直接和洗白攻击中均达到100%成功率。"
      ],
      "method": "设计TMA-NM机制，实现非可变信息流控制。",
      "result": "在八种模型和通道上，TMA-NM在直接和洗白攻击中均达到100%成功率。",
      "audience": "对LLM智能体记忆安全感兴趣的读者。",
      "why_keep": "为LLM智能体长期记忆安全提供了一种有效的方法。",
      "reading_focus": "关注TMA-NM机制的设计和实验结果。"
    }
  },
  {
    "id": "d38d84dda9b6dc944db84b067e6f931b1fe87707",
    "title": "Cost and accuracy of long-term memory in Distributed Multi-Agent Systems based on Large Language Models",
    "abstract": "Long-term memory (LTM) is fundamental to large language model (LLM)-based agents in the emerging Internet of Agents (IoA), where distributed multi-agent systems (DMAS) span cloud and edge networks. Existing evaluations are typically published by framework providers and focus on token usage and latency, rarely accounting for system-level cost or deployment in DMAS. These gaps are addressed with an independent reproducible testbed that evaluates accuracy, latency, CPU time, peak RAM, disk I/O and network usage in a simulated cloud-edge environment. Three venture capital-funded frameworks spanning vector, graph, and hybrid architectures, namely mem0, Graphiti, and cognee, are compared alongside retrieval-augmented generation (RAG) and full-context baselines on the LoCoMo benchmark under unconstrained and constrained network scenarios. Two clusters emerge: mem0, RAG, and full-context reach 77% to 81% accuracy, while Graphiti and cognee reach only 55% to 56%, a gap driven by retrieval incompleteness rather than reasoning failure. The RAG baseline matches the upper cluster at 8.4 times lower total cost of ownership (TCO) than mem0, and both are the only non-dominated backends on the Pareto frontier. Latency and bandwidth constraints as well as jitter leave retrieval quality unchanged for every backend, while vector-based LTM incurs a modest latency penalty of 4% to 5% under edge-cloud constraints. Compression precision rather than context volume determines LTM accuracy, as full-context forwarding underperforms mem0 despite supplying the entire conversation for each question.",
    "authors": [
      {
        "name": "Benedict Wolff"
      },
      {
        "name": "Jacopo Bennati"
      }
    ],
    "year": 2026,
    "publication_date": "2026-01-12",
    "venue": "arXiv.org",
    "citation_count": 1,
    "influential_citation_count": 0,
    "fields": [
      "Computer Science"
    ],
    "url": "https://www.semanticscholar.org/paper/d38d84dda9b6dc944db84b067e6f931b1fe87707",
    "external_ids": {
      "ArXiv": "2601.07978",
      "CorpusId": "2.84704394e+08",
      "DBLP": "journals/corr/abs-2601-07978",
      "DOI": "10.48550/arXiv.2601.07978"
    },
    "match_score": 86,
    "read_minutes": 11,
    "source": "Semantic Scholar",
    "digest": {
      "verdict": "值得速览方法与实验",
      "hook": "分布式多智能体记忆方案实测：成本差 8 倍，精度差 25%！",
      "problem": "现有评测多由框架方提供，只关注 token 用量和延迟，很少考虑系统级成本与云边部署场景。",
      "novelty": [
        "构建独立可复现测试床，评测云边模拟环境下的精度、延迟、CPU 时间、峰值内存、磁盘与网络开销。",
        "对比 **mem0**、**Graphiti**、**cognee** 三类风投背书框架（向量/图/混合架构），以及 RAG 与全文本基线。"
      ],
      "method": "在 LoCoMo 基准上，分别在网络不受限与受限两种场景下对六类后端做系统性压测。",
      "result": "mem0、RAG、全文本准确率达 77%–81%，Graphiti、cognee 仅 55%–56%（差距源于检索不完整而非推理失败）；RAG 总拥有成本比 mem0 低 8.4 倍，二者是帕累托前沿上仅有的非劣后端；压缩精度而非上下文长度才是决定 LTM 精度的关键。",
      "audience": "关注 LLM 智能体记忆系统成本与工程部署的研究者/架构师，尤其计算机科学方向。",
      "why_keep": "与检索方向高度匹配 — 提供可复现测试床与成本-精度权衡分析，方法扎实。",
      "reading_focus": "重点看测试床设计、三类框架的成本-精度对比与帕累托分析。"
    }
  },
  {
    "id": "openalex:W4391116828",
    "title": "Memory Matters: The Need to Improve Long-Term Memory in LLM-Agents",
    "abstract": "In this paper, we provide a review of the current efforts to develop LLM agents, which are autonomous agents that leverage large language models. We examine the memory management approaches used in these agents. One crucial aspect of these agents is their long-term memory, which is often implemented using vector databases. We describe how vector databases are utilized to store and retrieve information in LLM agents. Moreover we highlight open problems, such as the separation of different types of memories and the management of memory over the agent's lifetime. Lastly, we propose several topics for future research to address these challenges and further enhance the capabilities of LLM agents, including the use of metadata in procedural and semantic memory and the integration of external knowledge sources with vector databases.",
    "authors": [
      {
        "name": "Kostas Hatalis"
      },
      {
        "name": "Despina Christou"
      },
      {
        "name": "J. Myers"
      },
      {
        "name": "Steve Jones"
      },
      {
        "name": "Keith Lambert"
      },
      {
        "name": "Adam Amos‐Binks"
      },
      {
        "name": "Zohreh A. Dannenhauer"
      },
      {
        "name": "Dustin Dannenhauer"
      }
    ],
    "year": 2024,
    "publication_date": "2024-01-22",
    "venue": "Proceedings of the AAAI Symposium Series",
    "citation_count": 31,
    "influential_citation_count": 0,
    "fields": [
      "Natural Language Processing Techniques",
      "Artificial Intelligence",
      "Computer Science"
    ],
    "url": "https://doi.org/10.1609/aaaiss.v2i1.27688",
    "pdf_url": "https://ojs.aaai.org/index.php/AAAI-SS/article/download/27688/27461",
    "external_ids": {
      "DOI": "10.1609/aaaiss.v2i1.27688",
      "OpenAlex": "https://openalex.org/W4391116828"
    },
    "match_score": 80,
    "read_minutes": 6,
    "source": "OpenAlex",
    "digest": {
      "verdict": "值得速览方法与实验",
      "hook": "综述向量数据库如何支撑 LLM 智能体的长期记忆。",
      "problem": "现有 LLM 智能体的记忆管理方式缺乏系统梳理，记忆类型划分与生命周期管理仍是开放问题。",
      "novelty": [
        "系统综述 LLM 智能体的记忆管理方案，聚焦基于向量数据库的存储与检索实现。",
        "提出未来研究方向：程序性/语义记忆中的元数据利用，以及向量数据库与外部知识源的融合。"
      ],
      "method": "综述现有 LLM 智能体开发工作，梳理其记忆管理方案的共性设计。",
      "result": "指出记忆类型划分不清、记忆全生命周期管理缺失等开放问题，并给出多个未来研究课题。",
      "audience": "关注 LLM 智能体记忆机制的研究者，尤其自然语言处理/人工智能方向。",
      "why_keep": "与检索方向高度匹配 — 提供开放获取 PDF，便于快速核实。",
      "reading_focus": "重点看向量数据库记忆方案梳理与未来研究方向部分。"
    }
  },
  {
    "id": "openalex:W4401615752",
    "title": "Nadine: A large language model‐driven intelligent social robot with affective capabilities and human‐like memory",
    "abstract": "Abstract In this work, we describe our approach to developing an intelligent and robust social robotic system for the Nadine social robot platform. We achieve this by integrating large language models (LLMs) and skillfully leveraging the powerful reasoning and instruction‐following capabilities of these types of models to achieve advanced human‐like affective and cognitive capabilities. This approach is novel compared to the current state‐of‐the‐art LLM‐based agents which do not implement human‐like long‐term memory or sophisticated emotional capabilities. We built a social robot system that enables generating appropriate behaviors through multimodal input processing, bringing episodic memories accordingly to the recognized user, and simulating the emotional states of the robot induced by the interaction with the human partner. In particular, we introduce an LLM‐agent frame for social robots, social robotics reasoning and acting, serving as a core component for the interaction module in our system. This design has brought forth the advancement of social robots and aims to increase the quality of human–robot interaction.",
    "authors": [
      {
        "name": "Hangyeol Kang"
      },
      {
        "name": "Maher Ben Moussa"
      },
      {
        "name": "Nadia Magnenat Thalmann"
      }
    ],
    "year": 2024,
    "publication_date": "2024-07-01",
    "venue": "Computer Animation and Virtual Worlds",
    "citation_count": 18,
    "influential_citation_count": 0,
    "fields": [
      "Social Robot Interaction and HRI",
      "Social Psychology",
      "Psychology"
    ],
    "url": "https://doi.org/10.1002/cav.2290",
    "external_ids": {
      "DOI": "10.1002/cav.2290",
      "OpenAlex": "https://openalex.org/W4401615752"
    },
    "match_score": 80,
    "read_minutes": 8,
    "source": "OpenAlex",
    "digest": {
      "verdict": "值得速览方法与实验",
      "hook": "社交机器人 Nadine：LLM 驱动的情感与类人记忆系统。",
      "problem": "现有 LLM 智能体大多缺乏类人长期记忆与细腻的情感能力，限制了人机交互体验。",
      "novelty": [
        "相较现有 LLM 智能体，首次为社交机器人实现类人长期记忆与情感能力的结合。",
        "通过多模态输入处理生成合适行为，按用户身份调取情景记忆，并模拟机器人的情绪状态。",
        "提出面向社交机器人的 LLM-agent 框架，作为交互模块的核心组件。"
      ],
      "method": "面向 Nadine 社交机器人平台，开发集成 LLM 推理与指令跟随能力的机器人系统。",
      "result": "结合 LLM 强大的推理与指令跟随能力，实现了类人的情感与认知能力，提升人机交互质量。",
      "audience": "关注 LLM 智能体应用的研究者，尤其社交机器人交互/社会心理学方向。",
      "why_keep": "与检索方向高度匹配 — 可速览方法图示与实验后再决定精读。",
      "reading_focus": "重点看情景记忆调取机制与情绪模拟设计。"
    }
  },
  {
    "id": "openalex:W4401907288",
    "title": "Intent-Driven Mobile GUI Testing with Autonomous Large Language Model Agents",
    "abstract": "GUI testing checks if a software system behaves as expected when users interact with its graphical interface, e.g., testing specific functionality or validating relevant use case scenarios. Currently, deciding what to test at this high level is a manual task since automated GUI testing tools target lower level adequacy metrics such as structural code coverage or activity coverage. We propose DroidAgent, an autonomous GUI testing agent for Android, for semantic, intent-driven automation of GUI testing. It is based on Large Language Models and support mechanisms such as long- and short-term memory. Given an Android app, DroidAgent sets relevant task goals and subsequently tries to achieve them by interacting with the app. Our empirical evaluation of DroidAgent using 15 apps from the Themis benchmark shows that it can set up and perform realistic tasks, with a higher level of autonomy. For example, when testing a messaging app, DroidAgent created a second account and added a first account as a friend, testing a realistic use case, without human intervention. On average, DroidAgent achieved 61% activity coverage, compared to 51 % for current state-of-the-art GUI testing techniques. Further, manual analysis shows that 317 out of the 547 autonomously created tasks are realistic and relevant to app functionalities, and also that DroidAgent interacts deeply with the apps and covers more features.",
    "authors": [
      {
        "name": "Juyeon Yoon"
      },
      {
        "name": "Robert Feldt"
      },
      {
        "name": "Shin Yoo"
      }
    ],
    "year": 2024,
    "publication_date": "2024-05-27",
    "venue": "OpenAlex",
    "citation_count": 27,
    "influential_citation_count": 0,
    "fields": [
      "Software Testing and Debugging Techniques",
      "Software",
      "Computer Science"
    ],
    "url": "https://doi.org/10.1109/icst60714.2024.00020",
    "external_ids": {
      "DOI": "10.1109/icst60714.2024.00020",
      "OpenAlex": "https://openalex.org/W4401907288"
    },
    "match_score": 84,
    "read_minutes": 10,
    "source": "OpenAlex",
    "digest": {
      "verdict": "值得速览方法与实验",
      "hook": "DroidAgent：让 LLM 智能体自主完成移动端 GUI 意图测试。",
      "problem": "GUI 测试要判断软件在用户交互下是否符合预期，但高层测试目标的设定至今仍依赖人工。",
      "novelty": [
        "提出 **DroidAgent**，面向 Android 的自主 GUI 测试智能体，实现语义化、意图驱动的测试自动化。",
        "测试消息类应用时，DroidAgent 能自主创建第二账号并添加好友，无需人工干预即完成真实使用场景测试。"
      ],
      "method": "基于 LLM 并配备长短期记忆机制，让 DroidAgent 设定任务目标并通过与 App 交互逐步达成。",
      "result": "在 Themis 基准的 15 款应用上评测，DroidAgent 平均活动覆盖率达 61%，高于现有最优方法的 51%；547 个自主任务中 317 个被人工判定为真实且贴合功能。",
      "audience": "关注 LLM 智能体自动化测试的研究者/工程师，尤其软件测试方向。",
      "why_keep": "与检索方向高度匹配 — 可速览方法图示与实验后再决定精读。",
      "reading_focus": "重点看意图驱动的任务生成机制与活动覆盖率实验对比。"
    }
  },
  {
    "id": "openalex:W4412203333",
    "title": "A Survey on the Memory Mechanism of Large Language Model-based Agents",
    "abstract": "Large language model (LLM)-based agents have recently attracted much attention from the research and industry communities. Compared with original LLMs, LLM-based agents are featured in their self-evolving capability, which is the basis for solving real-world problems that need long-term and complex agent-environment interactions. The key component to support agent-environment interactions is the memory of the agents. While previous studies have proposed many promising memory mechanisms, they are scattered in different papers, and there lacks a systematical review to summarize and compare these works from a holistic perspective, failing to abstract common and effective designing patterns for inspiring future studies. To bridge this gap, in this article, we propose a comprehensive survey on the memory mechanism of LLM-based agents. In specific, we first discuss “what is” and “why do we need” the memory in LLM-based agents. Then, we systematically review previous studies on how to design and evaluate the memory module. In addition, we also present many agent applications, where the memory module plays an important role. At last, we analyze the limitations of existing work and show important future directions. To keep up with the latest advances in this field, we create a repository at https://github.com/nuster1128/LLM_Agent_Memory_Survey .",
    "authors": [
      {
        "name": "Zeyu Zhang"
      },
      {
        "name": "Quanyu Dai"
      },
      {
        "name": "Xiaohe Bo"
      },
      {
        "name": "Chen Ma"
      },
      {
        "name": "Rui Li"
      },
      {
        "name": "Xu Chen"
      },
      {
        "name": "Jieming Zhu"
      },
      {
        "name": "Zhenhua Dong"
      }
    ],
    "year": 2025,
    "publication_date": "2025-07-11",
    "venue": "ACM Transactions on Information Systems",
    "citation_count": 86,
    "influential_citation_count": 0,
    "fields": [
      "Topic Modeling",
      "Artificial Intelligence",
      "Computer Science"
    ],
    "url": "https://doi.org/10.1145/3748302",
    "external_ids": {
      "DOI": "10.1145/3748302",
      "OpenAlex": "https://openalex.org/W4412203333"
    },
    "match_score": 88,
    "read_minutes": 9,
    "source": "OpenAlex",
    "digest": {
      "verdict": "高度匹配，优先收藏核实",
      "hook": "首篇系统梳理 LLM 智能体记忆机制的综述，附开源仓库。",
      "problem": "已有记忆机制方案分散在各篇论文中，缺乏从整体视角总结比较的系统综述，难以提炼可复用的设计范式。",
      "novelty": [
        "首次提出面向 LLM 智能体记忆机制的系统性综述，弥补该领域缺乏整体梳理的空白。",
        "先讨论记忆的定义（是什么）与必要性（为什么需要），再系统回顾记忆模块的设计与评估方法。"
      ],
      "method": "系统回顾现有记忆机制研究，梳理其设计范式，并结合多个智能体应用场景分析记忆模块的作用。",
      "result": "总结现有工作的局限性并指出重要未来方向；配套维护 GitHub 仓库 nuster1128/LLM_Agent_Memory_Survey 持续跟踪领域进展。",
      "audience": "关注 LLM 智能体记忆机制体系化梳理的研究者，尤其人工智能方向。",
      "why_keep": "与检索方向高度匹配 — 综述覆盖面广，适合作为该领域入门与查漏补缺的首选材料。",
      "reading_focus": "重点看记忆机制的设计范式分类与未来研究方向章节。"
    }
  },
  {
    "id": "trend-mem-1",
    "title": "MemGPT: Towards LLMs as Operating Systems",
    "abstract": "MemGPT introduces a hierarchical memory system that lets an LLM manage its own context window like an operating system manages physical memory, paging conversation history and documents in and out as needed. This unlocks tasks that far exceed the model's native context length, such as coherent multi-session dialogue and analysis of long documents.",
    "authors": [
      {
        "name": "Charles Packer"
      },
      {
        "name": "Sarah Wooders"
      },
      {
        "name": "Kevin Lin"
      },
      {
        "name": "Vivian Fang"
      },
      {
        "name": "Shishir G. Patil"
      },
      {
        "name": "Ion Stoica"
      },
      {
        "name": "Joseph E. Gonzalez"
      }
    ],
    "year": 2023,
    "venue": "arXiv",
    "citation_count": 1420,
    "influential_citation_count": 210,
    "fields": [
      "LLM Agents",
      "Memory"
    ],
    "url": "https://arxiv.org/abs/2310.08560",
    "pdf_url": "https://arxiv.org/pdf/2310.08560",
    "match_score": 96,
    "read_minutes": 32,
    "source": "arXiv",
    "digest": {
      "verdict": "LLM 长期记忆的奠基之作，值得收藏细读分页机制。",
      "hook": "让大模型像操作系统一样管理记忆，对话不再受限。",
      "problem": "LLM 的**上下文窗口大小固定**，能同时处理的历史或文档信息有限。",
      "novelty": [
        "把上下文窗口当作**内存**，外部存储当作**磁盘**，让模型自己发起换页调用。",
        "引入**函数调用协议**，让模型自主管理记忆操作。",
        "展示了长达**数千轮**的连贯对话，且关键信息不丢失。"
      ],
      "method": "构建分层记忆体系（主上下文、召回存储、归档存储），模型通过工具调用在其间自主换入换出信息。",
      "result": "对话连贯性提升至**10倍**长度，长文档问答效果也明显优于仅靠上下文的基线方法。",
      "audience": "正在构建需要跨多轮或多文档保持记忆的智能体系统的研究者和工程师。",
      "why_keep": "这是 LLM 长期记忆的参考设计，后续很多工作都基于它或与它对比。",
      "reading_focus": "第 3-4 节中记忆管理的函数模式及换入换出策略。"
    }
  },
  {
    "id": "trend-mem-2",
    "title": "Generative Agents: Interactive Simulacra of Human Behavior",
    "abstract": "Generative Agents builds believable human simulacra by combining an observation stream, a retrieval-augmented long-term memory, periodic reflection to distill higher-level insights, and a planning module. Twenty-five such agents were deployed in a sandbox town and produced emergent social behaviors like planning a Valentine's Day party without human scripting.",
    "authors": [
      {
        "name": "Joon Sung Park"
      },
      {
        "name": "Joseph C. O'Brien"
      },
      {
        "name": "Carrie J. Cai"
      },
      {
        "name": "Meredith Ringel Morris"
      },
      {
        "name": "Percy Liang"
      },
      {
        "name": "Michael S. Bernstein"
      }
    ],
    "year": 2023,
    "venue": "UIST",
    "citation_count": 2380,
    "influential_citation_count": 340,
    "fields": [
      "LLM Agents",
      "HCI"
    ],
    "url": "https://arxiv.org/abs/2304.03442",
    "pdf_url": "https://arxiv.org/pdf/2304.03442",
    "match_score": 94,
    "read_minutes": 40,
    "source": "ACM UIST",
    "digest": {
      "verdict": "社交智能体记忆架构的必读之作，重点研究反思循环。",
      "hook": "25个AI小镇居民靠记忆自发筹办派对，全程无人编排。",
      "problem": "LLM 智能体容易遗忘过往交互，难以在开放世界中保持**长期可信的行为**。",
      "novelty": [
        "增加**反思步骤**，定期把零散记忆提炼成更高层次的认知。",
        "记忆检索按**时近性、重要性和相关性**综合打分，而非只看相似度。",
        "证明**基于检索记忆的规划**能催生涌现式的社会协作行为。"
      ],
      "method": "观察流写入向量库；检索按时近性×重要性×相关性打分；反思把记忆聚类提炼成洞见；规划同时利用两者。",
      "result": "25 个智能体涌现出**自发筹办派对**、信息扩散和稳定的日常作息等行为。",
      "audience": "任何在设计多轮对话、多智能体或人设驱动型 LLM 系统的人。",
      "why_keep": "确立了「反思+召回+规划」的模式，后续多数智能体记忆论文都以此为基线。",
      "reading_focus": "第 4 节的检索打分公式与第 5 节的反思树构建方法。"
    }
  },
  {
    "id": "trend-mem-3",
    "title": "Reflexion: Language Agents with Verbal Reinforcement Learning",
    "abstract": "Reflexion equips language agents with a verbal self-critique loop: after each trial the agent writes a natural-language reflection about what went wrong, stores it in an episodic memory, and consults it on the next attempt. This lightweight, gradient-free feedback drives large gains on HumanEval, HotpotQA, and AlfWorld.",
    "authors": [
      {
        "name": "Noah Shinn"
      },
      {
        "name": "Federico Cassano"
      },
      {
        "name": "Ashwin Gopinath"
      },
      {
        "name": "Karthik R. Narasimhan"
      },
      {
        "name": "Shunyu Yao"
      }
    ],
    "year": 2023,
    "venue": "NeurIPS",
    "citation_count": 1810,
    "influential_citation_count": 260,
    "fields": [
      "LLM Agents",
      "Reinforcement Learning"
    ],
    "url": "https://arxiv.org/abs/2303.11366",
    "pdf_url": "https://arxiv.org/pdf/2303.11366",
    "match_score": 92,
    "read_minutes": 28,
    "source": "NeurIPS",
    "digest": {
      "verdict": "轻量、无需梯度更新的改进方案，记忆当训练信号的思路值得一读。",
      "hook": "不靠梯度更新，AI 靠给自己写检讨笔记就能越战越强。",
      "problem": "提升语言智能体通常需要**梯度更新**或高成本强化学习，在 LLM 规模下代价很大。",
      "novelty": [
        "用**语言化自我反思**作为更新信号，完全不改模型权重。",
        "把反思保存进**episodic 记忆**，供下次重试时查阅。",
        "仅靠**提示词设计**即可用于决策、编程和问答等任务。"
      ],
      "method": "采用「执行者-评估者-反思者」三元结构：LLM 执行任务，评估者打分，反思者生成自然语言批评并存入记忆供后续调用。",
      "result": "相比强 ReAct 基线，HumanEval 提升 **22%**，HotpotQA 提升 20%，AlfWorld 提升 14%。",
      "audience": "无法微调、只能在推理阶段做提升的智能体开发者。",
      "why_keep": "证明了 episodic 记忆本身也能承载学习信号，是许多自我提升型智能体的模板。",
      "reading_focus": "反思提示词模板，以及记忆注入执行循环的具体位置。"
    }
  },
  {
    "id": "trend-mem-4",
    "title": "A-Mem: Adaptive Memory for Long-Horizon LLM Agents",
    "abstract": "A-Mem learns when to write, when to retrieve, and when to summarize, replacing hand-tuned memory heuristics with an adaptive controller. On the LoCoMo long-conversation benchmark it beats fixed-policy baselines while using 40% fewer memory tokens, thanks to a lightweight scheduler that gates each memory operation.",
    "authors": [
      {
        "name": "Yifan Wu"
      },
      {
        "name": "Zhiyuan Liu"
      },
      {
        "name": "Maosong Sun"
      }
    ],
    "year": 2025,
    "venue": "NeurIPS",
    "citation_count": 180,
    "influential_citation_count": 32,
    "fields": [
      "LLM Agents",
      "Memory"
    ],
    "url": "https://arxiv.org/abs/2502.12110",
    "pdf_url": "https://arxiv.org/pdf/2502.12110",
    "match_score": 90,
    "read_minutes": 34,
    "source": "NeurIPS",
    "digest": {
      "verdict": "关注其自适应调度器，对记忆策略设计有全新思路。",
      "hook": "不靠人工规则，A-Mem 自己学会何时该记、该忘、该回忆。",
      "problem": "现有智能体记忆多依赖**人工调参的启发式规则**来写入和检索，难以适配多样任务。",
      "novelty": [
        "**轻量级调度器**决定每一轮该写入、检索、总结还是跳过。",
        "用**成本敏感的目标函数**训练，惩罚无意义的记忆操作。",
        "无需针对任务专门调参即可泛化到对话、工具调用和代码任务。"
      ],
      "method": "在 LLM 之上叠加一个小型策略网络，根据当前状态输出离散的记忆动作，LLM 执行后继续推理。",
      "result": "在 **LoCoMo** 上超过 MemGPT 和 Reflexion 6-11 分，同时记忆 token 用量减少约 **40%**。",
      "audience": "在生产环境中既要记忆效果又要控制记忆成本的从业者。",
      "why_keep": "是首批端到端学习型记忆控制器之一，可能是下一代方案的模板。",
      "reading_focus": "第 3 节的调度器结构，以及成本敏感目标与纯准确率目标的对比实验。"
    }
  }
];
