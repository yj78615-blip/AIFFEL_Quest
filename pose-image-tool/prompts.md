# 테스트 프롬프트 모음

## 포즈 1 — 정면을 향해 역동적으로 공격
```
늑대인간이 숲에서 정면을 향해 역동적으로 공격하고 있고 빛은 후광 달빛이고 밤이다.
```
- 결과: 자세는 잡혔으나 역동감이 부족하고 디테일이 약함.
- 결과 파일: [`samples/output_01.webp`](samples/output_01.webp)

## 포즈 2 — 후방을 향해 역동적으로 도망
```
늑대인간이 숲에서 후방을 향해 역동적으로 도망치고 있고 빛은 후광 달은 멀리서 빛나고 있다 밤이다.
```
- 결과: 도망치는 자세는 맞으나 늑대인간이 아닌 늑대로 변해 있고 다리가 하나 더 그려짐.
- 결과 파일: [`samples/output_02.webp`](samples/output_02.webp)

## 공통 설정
- 모델: FLUX.2-klein-4B (GGUF Q4_K_M)
- 텍스트 인코더: Qwen3-4B
- 샘플러: `euler` / 스케줄러: `simple` / CFG 4.0 / denoise 1.0
- 기본 스텝: 4 (distilled 모델 권장값)
- 해상도: 1024×1024
- 네거티브 프롬프트: 미사용

## 개선 팁 (다음 시도용)
- 시점 고정: `front view, facing camera` / `back view` 등을 프롬프트 앞부분에 명시.
- 역동성 강화: `dynamic action pose, motion blur, low camera angle, wind, flying debris` 같은 키워드 추가.
- 스텝 수를 6~8로 올려서 디테일 확보.
