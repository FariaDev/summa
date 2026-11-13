import Base
import ../accent.bend as A

# Contrato da cor de acento: dois nomes válidos, o grafite como padrão, e
# qualquer outra coisa (ausente, tipo errado, caixa diferente, espaço, nome
# desconhecido e as cores que saíram — blue, green, orange, pink) cai no
# fallback. Os nomes são concretos porque String.eq não reduz em String livre.

law accent_default_is_graphite:
  {A.accentDefault() == A.AccentGraphite{} : A.Accent}

law accent_graphite:
  for fallback: A.Accent
  {A.parseAccent("graphite", fallback) == A.AccentGraphite{} : A.Accent}

law accent_violet:
  for fallback: A.Accent
  {A.parseAccent("violet", fallback) == A.AccentViolet{} : A.Accent}

# As cores que saíram do app (azul, verde, laranja, rosa) não são mais nomes
# válidos: caem no fallback.
law accent_blue_falls_back:
  for fallback: A.Accent
  {A.parseAccent("blue", fallback) == fallback : A.Accent}

law accent_green_falls_back:
  for fallback: A.Accent
  {A.parseAccent("green", fallback) == fallback : A.Accent}

law accent_orange_falls_back:
  for fallback: A.Accent
  {A.parseAccent("orange", fallback) == fallback : A.Accent}

law accent_pink_falls_back:
  for fallback: A.Accent
  {A.parseAccent("pink", fallback) == fallback : A.Accent}

# Nome desconhecido, outra caixa e espaço sobrando: fallback.
law accent_unknown_falls_back:
  for fallback: A.Accent
  {A.parseAccent("rouge", fallback) == fallback : A.Accent}

law accent_case_sensitive:
  for fallback: A.Accent
  {A.parseAccent("GRAPHITE", fallback) == fallback : A.Accent}

law accent_padded_falls_back:
  for fallback: A.Accent
  {A.parseAccent("violet ", fallback) == fallback : A.Accent}

law accent_empty_falls_back:
  for fallback: A.Accent
  {A.parseAccent("", fallback) == fallback : A.Accent}

# Ausente ou de tipo errado (o host entrega `None`) usa o fallback.
law accent_missing_uses_fallback:
  for fallback: A.Accent
  {A.accentOrDefault(None{}, fallback) == fallback : A.Accent}

law accent_present_is_parsed:
  for fallback: A.Accent
  {A.accentOrDefault(Some{"violet"}, fallback) == A.AccentViolet{} : A.Accent}

# Quem nunca escolheu vê grafite; quem escolheu, o que escolheu.
law accent_never_chosen_is_graphite:
  {A.normalizeAccent(None{}) == A.AccentGraphite{} : A.Accent}

law accent_garbage_is_graphite:
  {A.normalizeAccent(Some{"roxo"}) == A.AccentGraphite{} : A.Accent}

# Estado salvo com uma cor removida vira grafite, sem erro.
law accent_saved_blue_is_graphite:
  {A.normalizeAccent(Some{"blue"}) == A.AccentGraphite{} : A.Accent}

law accent_saved_pink_is_graphite:
  {A.normalizeAccent(Some{"pink"}) == A.AccentGraphite{} : A.Accent}

law accent_choice_is_kept:
  {A.normalizeAccent(Some{"graphite"}) == A.AccentGraphite{} : A.Accent}

law accent_violet_is_kept:
  {A.normalizeAccent(Some{"violet"}) == A.AccentViolet{} : A.Accent}
