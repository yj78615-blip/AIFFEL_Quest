# pose-image-tool

원하는 포즈로 이미지 만드는 도구 — FLUX.2-klein-4B (GGUF Q4) 를 Colab + ComfyUI + Gradio 로 실행하는 실습 노트북.

## 도구 설명
- FLUX.2-klein-4B 텍스트→이미지 모델을 Colab 무료 T4 GPU 에서 ComfyUI 로 돌리고, Gradio 웹 UI 로 프롬프트를 넣어 이미지를 생성한다.
- GGUF Q4 양자화(16GB → 2.6GB)로 Colab RAM 한계를 우회한다.

## 사용법
1. Colab 에서 노트 열기: https://colab.research.google.com/drive/1JqFvHuBueCPSRerl-QS5Lz9El2x6twB4?usp=sharing (저장소의 [`pose_tool.ipynb`](pose_tool.ipynb) 와 동일) → 런타임을 **T4 GPU** 로 변경.
2. 셀을 1번부터 순서대로 실행:
   - **단계 1** GPU 확인
   - **단계 2** ComfyUI + ComfyUI-GGUF 노드 설치
   - **단계 3** 모델 3종 다운로드 (디퓨전 GGUF 2.6GB · Qwen3-4B 텍스트 인코더 8GB · VAE 330MB, 총 ~11GB)
   - **단계 4** ComfyUI 서버 백그라운드 기동 (`127.0.0.1:8188`)
   - **단계 5** Gradio UI 실행 → 출력된 `gradio.live` 링크 접속 후 프롬프트 입력 → [이미지 생성]
3. 결과 이미지는 `/content/flux2_out_<타임스탬프>.png` 및 `/content/ComfyUI/output/` 에 저장된다.

## 테스트 결과
프롬프트 원문은 [`prompts.md`](prompts.md) 참고.

- 포즈 1: 정면을 향해 역동적으로 공격 → 프롬프트: "늑대인간이 숲에서 정면을 향해 역동적으로 공격하고 있고 빛은 후광 달빛이고 밤이다." → 결과: 자세는 잡혔으나 역동감·디테일 부족 ([pose_01](samples/pose_01.webp) → [output_01](samples/output_01.webp))
- 포즈 2: 후방을 향해 역동적으로 도망 → 프롬프트: "늑대인간이 숲에서 후방을 향해 역동적으로 도망치고 있고 빛은 후광 달은 멀리서 빛나고 있다 밤이다." → 결과: 도망치는 자세는 맞으나 늑대인간이 아닌 늑대로 변해 있고 다리가 하나 더 그려짐 ([pose_02](samples/pose_02.webp) → [output_02](samples/output_02.webp))

## 한계
- 이 노트북은 **텍스트→이미지 전용**이라 참고 이미지·포즈 스켈레톤을 실제 입력으로 넣을 수 없다. 자세·시점은 프롬프트 문장으로만 지정된다.
- 기본 스텝 수가 4(distilled 권장값)로 낮아 근육 긴장·움직임 흐름 같은 역동성 디테일이 흐릿해지기 쉽다. 스텝 6~8로 올리거나 "dynamic action pose, motion blur, low camera angle" 같은 시점·움직임 키워드를 추가하면 개선 여지가 있다.
- 카메라 방향(정면/측면)이 프롬프트만으로는 자주 어긋난다. "front view, facing camera" 같은 시점 키워드를 명시해야 안정적.
